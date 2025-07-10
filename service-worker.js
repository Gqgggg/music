// ... (inside your existing script block in index.html) ...

// IndexedDB Constants
const IDB_DATABASE_NAME = 'music-db';
const IDB_STORE_NAME = 'tracks';

// Helper to open IndexedDB
async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DATABASE_NAME, 1); // Version 1

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Function to download and store a track
async function downloadAndStoreTrack(track) {
  if (!track || !track.url) {
    console.error('Invalid track object for download:', track);
    return false;
  }

  // Generate a unique ID for the track in IndexedDB
  const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const db = await openIndexedDB();
    const response = await fetch(track.url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const audioBlob = await response.blob();
    const mimeType = response.headers.get('Content-Type') || 'audio/mpeg';

    const transaction = db.transaction([IDB_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(IDB_STORE_NAME);

    // Store the audio blob and original metadata
    const dataToStore = {
      id: trackId, // Unique ID for IndexedDB
      title: track.title,
      artist: track.artist,
      originalUrl: track.url, // Keep original URL
      audioBlob: audioBlob,
      mimeType: mimeType,
      cover: track.cover || defaultCoverArt,
    };

    await store.add(dataToStore);

    // Update the original playlist item to point to the IndexedDB URL
    // This assumes your playlist items are mutable objects.
    // You might need to find the specific track in your `playlist` array and update it.
    const originalTrackIndex = playlist.findIndex(t => t.url === track.url);
    if (originalTrackIndex !== -1) {
      playlist[originalTrackIndex].offlineUrl = `indexeddb://${trackId}`; // Custom URL scheme
      playlist[originalTrackIndex].isDownloaded = true;
      renderPlaylist(); // Re-render to update UI (e.g., show delete button)
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error downloading and storing track:', error);
    alert('Failed to download music. See console for details.');
    return false;
  }
}

// Function to delete a track from IndexedDB
async function deleteStoredTrack(track) {
    if (!track || !track.offlineUrl) return false;

    const urlObj = new URL(track.offlineUrl);
    if (urlObj.protocol !== 'indexeddb:') {
        console.warn('Track is not an IndexedDB URL, cannot delete:', track.offlineUrl);
        return false;
    }
    const trackId = urlObj.hostname;

    try {
        const db = await openIndexedDB();
        const transaction = db.transaction([IDB_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);

        await store.delete(trackId);

        // Update the original playlist item
        const originalTrackIndex = playlist.findIndex(t => t.offlineUrl === track.offlineUrl);
        if (originalTrackIndex !== -1) {
            delete playlist[originalTrackIndex].offlineUrl; // Remove offline URL
            playlist[originalTrackIndex].isDownloaded = false;
            renderPlaylist(); // Re-render to update UI
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting track from IndexedDB:', error);
        alert('Failed to delete music. See console for details.');
        return false;
    }
}

// Function to check if a track is downloaded
async function isTrackDownloaded(track) {
  if (!track || !track.url) return false;

  const db = await openIndexedDB();
  const transaction = db.transaction([IDB_STORE_NAME], 'readonly');
  const store = transaction.objectStore(IDB_STORE_NAME);
  // Iterate through store to find matching originalUrl or similar identifier
  // For simplicity, let's assume we store the original URL with the downloaded track data
  const request = store.openCursor();
  return new Promise((resolve) => {
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.originalUrl === track.url) {
          // Update the playlist track's offlineUrl if it exists in IDB
          track.offlineUrl = `indexeddb://${cursor.value.id}`;
          track.isDownloaded = true;
          resolve(true);
          return;
        }
        cursor.continue();
      } else {
        resolve(false);
      }
    };
    request.onerror = () => resolve(false);
  });
}

// Modify renderPlaylist to show/hide download/delete buttons
function renderPlaylist() {
  playlistEl.innerHTML = '';

  const searchTerm = searchInput.value.trim().toLowerCase();

  filteredPlaylist = playlist.filter(track => {
    return (
      track.title.toLowerCase().includes(searchTerm) ||
      track.artist.toLowerCase().includes(searchTerm)
    );
  });

  if(filteredPlaylist.length === 0) {
    const emptyMsg = document.createElement('li');
    emptyMsg.textContent = locale.noSongsInPlaylist;
    emptyMsg.style.padding = '10px 20px';
    emptyMsg.style.color = '#777';
    playlistEl.appendChild(emptyMsg);
    return;
  }

  filteredPlaylist.forEach(async (track, idx) => { // Make async to await isTrackDownloaded
    const item = document.createElement('li');
    item.className = 'playlist-item';
    item.tabIndex = 0;
    item.dataset.idx = playlist.indexOf(track);

    if(playlist.indexOf(track) === currentIndex) {
      item.classList.add('active');
    }

    const img = document.createElement('img');
    img.src = track.cover || defaultCoverArt;
    img.alt = "";

    const titleArtist = document.createElement('div');
    titleArtist.className = 'title-artist';

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.textContent = track.title;

    const artistEl = document.createElement('div');
    artistEl.className = 'artist';
    artistEl.textContent = track.artist;

    titleArtist.appendChild(titleEl);
    titleArtist.appendChild(artistEl);

    item.appendChild(img);
    item.appendChild(titleArtist);

    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.setAttribute('aria-label', 'Download track');
    downloadBtn.textContent = '⬇️';
    downloadBtn.style.cssText = 'margin-left: auto; background: none; border: none; color: #eee; font-size: 1.2em; cursor: pointer;';
    downloadBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent playing the track when clicking download
        downloadBtn.disabled = true;
        downloadBtn.textContent = '⏳'; // Indicate downloading
        const success = await downloadAndStoreTrack(track);
        if (success) {
            alert(`"${track.title}" downloaded!`);
        } else {
            downloadBtn.textContent = '⬇️'; // Reset on failure
            downloadBtn.disabled = false;
        }
    });
    item.appendChild(downloadBtn);

    // Delete downloaded button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-download-btn';
    deleteBtn.setAttribute('aria-label', 'Delete downloaded track');
    deleteBtn.textContent = '🗑️';
    deleteBtn.style.cssText = 'background: none; border: none; color: #f00; font-size: 1.2em; cursor: pointer; display: none;'; // Hidden by default
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent playing the track when clicking delete
        deleteBtn.disabled = true;
        const success = await deleteStoredTrack(track);
        if (success) {
            alert(`"${track.title}" deleted from downloads.`);
        }
        deleteBtn.disabled = false;
    });
    item.appendChild(deleteBtn);

    // Check download status and update buttons
    const downloaded = await isTrackDownloaded(track);
    if (downloaded) {
      downloadBtn.style.display = 'none';
      deleteBtn.style.display = 'block';
    } else {
      downloadBtn.style.display = 'block';
      deleteBtn.style.display = 'none';
    }


    // Click or keyboard to select (original logic)
    item.addEventListener('click', () => {
      // If track is downloaded, play from offlineUrl, otherwise play from original URL
      const urlToPlay = track.isDownloaded ? track.offlineUrl : track.url;
      playTrack(playlist.indexOf(track), urlToPlay); // Pass URL to play
    });
    item.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const urlToPlay = track.isDownloaded ? track.offlineUrl : track.url;
        playTrack(playlist.indexOf(track), urlToPlay);
      }
    });

    playlistEl.appendChild(item);
  });
}

// Modify playTrack function to accept a URL to play
function playTrack(idx, urlToPlay = null) {
  if(idx < 0 || idx >= playlist.length) return;

  currentIndex = idx;
  const track = playlist[currentIndex];
  audio.src = urlToPlay || track.url; // Use provided URL or original URL
  audio.play().catch(() => {});
  isPlaying = true;
  updatePlayPauseButton();
  updateCoverArt(track.cover);
  updatePlaylistActive();
}

// ... (rest of your existing JavaScript code) ...

// In your init() function, after renderPlaylist(), you might want to call
// checkAllTracksDownloadStatus() to update buttons when app starts
async function checkAllTracksDownloadStatus() {
  for (const track of playlist) {
    await isTrackDownloaded(track); // This will update track.isDownloaded and track.offlineUrl
  }
  renderPlaylist(); // Re-render to show correct buttons
}

// Call this in init()
function init() {
    // ... existing event listeners ...

    updateCoverArt(defaultCoverArt);
    renderPlaylist(); // Initial render
    checkAllTracksDownloadStatus(); // Then check and update download status
    setupVisualizer();

    // ... service worker registration ...
}

// ... (end of your script block) ...