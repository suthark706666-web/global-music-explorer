/* Global Music Explorer - app.js
   Lightweight, modular front-end. Replace sampleData with server API when scaling.
*/

const GEOJSON_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';

// --- Sample dataset (replace/wire to API) ---
// keys are ISO_A2 country codes or friendly country names
const sampleData = {
    "IN": {
        name: "India",
        region: "Asia",
        tracks: [
            { id: "in1", title: "Monsoon Streets", artist: "Kavi Sundar", genre: "Indie Pop", src: "https://cdn.simple-mock/audio/india-monsoon-streets.mp3", duration: 186 },
            { id: "in2", title: "Desert Echoes", artist: "Riya & The Deltas", genre: "Indie Folk", src: "https://cdn.simple-mock/audio/india-desert-echoes.mp3", duration: 212 }
        ]
    },
    "US": {
        name: "United States",
        region: "Americas",
        tracks: [
            { id: "us1", title: "Dawn Drive", artist: "Brooklyn Noises", genre: "Indie Rock", src: "https://cdn.simple-mock/audio/us-dawn-drive.mp3", duration: 203 },
            { id: "us2", title: "Neon Alleys", artist: "Prairie Sun", genre: "Indie Electronic", src: "https://cdn.simple-mock/audio/us-neon-alleys.mp3", duration: 189 }
        ]
    },
    "FR": {
        name: "France",
        region: "Europe",
        tracks: [
            { id: "fr1", title: "Left Bank Sketches", artist: "Claire L.", genre: "Chill", src: "https://cdn.simple-mock/audio/fr-leftbank.mp3", duration: 174 }
        ]
    }
};

// ---------- UI hooks ----------
const mapEl = document.getElementById('map');
const countryNameEl = document.getElementById('countryName');
const countryMetaEl = document.getElementById('countryMeta');
const trackListEl = document.getElementById('trackList');
const playerTrackEl = document.getElementById('playerTrack');
const seek = document.getElementById('seek');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const searchInput = document.getElementById('search');
const regionFilter = document.getElementById('regionFilter');

// app state
let currentCountryCode = null;
let currentPlaylist = [];
let currentIndex = -1;
let geojsonLayer = null;

// ---------- init map ----------
function initMap() {
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 6,
        worldCopyJump: true,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 6,
        attribution: ''
    }).addTo(map);

    // load countries geojson
    fetch(GEOJSON_URL)
        .then(r => r.json())
        .then(data => {
            geojsonLayer = L.geoJSON(data, {
                style: defaultCountryStyle,
                onEachFeature: onEachCountry
            }).addTo(map);
        })
        .catch(err => {
            console.error('Failed to load country map:', err);
            countryNameEl.textContent = 'Map failed to load';
        });
}

function defaultCountryStyle() {
    return {
        color: '#123',
        weight: 0.6,
        fillColor: 'rgba(255,255,255,0.02)',
        fillOpacity: 1
    };
}

// highlight
function highlightFeature(e) {
    e.target.setStyle({
        weight: 2,
        color: '#fff',
        fillColor: 'rgba(29,185,84,0.12)'
    });
    if (!L.Browser.ie && !L.Browser.opera) {
        e.target.bringToFront();
    }
}

function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
}

function onEachCountry(feature, layer) {
    const props = feature.properties || {};
    const iso_a2 = (props.iso_a2 || props.ISO_A2 || props.iso_a3 || props.ADM0_A3 || '').toUpperCase();
    const name = props.name || props.NAME || props.admin || 'Unknown';
    layer.options.countryCode = iso_a2 || name;

    layer.on({
        mouseover: function (e) {
            highlightFeature(e);
            showTooltip(name, e.originalEvent.clientX, e.originalEvent.clientY);
        },
        mouseout: function (e) {
            resetHighlight(e);
            hideTooltip();
        },
        click: function (e) {
            const code = layer.options.countryCode;
            onCountryClick(code, name);
        }
    });
    countryLayers[iso_a2 || name] = layer;
}

// tooltip simple
const tooltip = document.getElementById('tooltip');
function showTooltip(text, x, y) {
    tooltip.textContent = text;
    tooltip.style.left = (x + 12) + 'px';
    tooltip.style.top = (y + 12) + 'px';
    tooltip.classList.remove('hidden');
}
function hideTooltip() { tooltip.classList.add('hidden'); }

// ---------- country click handler ----------
function onCountryClick(code, displayName) {
    currentCountryCode = code;
    const data = sampleData[code] || findByName(displayName) || null;

    countryNameEl.textContent = data ? `${data.name}` : displayName;
    countryMetaEl.textContent = data ? `Region: ${data.region}` : 'No tracks available for this country yet';

    currentPlaylist = data ? data.tracks.slice() : [];
    currentIndex = -1;
    renderTrackList();
    if (currentPlaylist.length === 0) {
        playerTrackEl.textContent = 'No track selected';
        audio.src = '';
    } else {
        // auto-select first track for quick playback
        selectTrack(0);
    }
}

function findByName(name) {
    // simple fallback: find sampleData where name matches
    for (const k in sampleData) {
        if (sampleData[k].name && sampleData[k].name.toLowerCase() === name.toLowerCase()) {
            return sampleData[k];
        }
    }
    return null;
}

// ---------- track list rendering ----------
function renderTrackList() {
    const q = searchInput.value.trim().toLowerCase();
    const region = regionFilter.value;
    trackListEl.innerHTML = '';

    const filtered = currentPlaylist.filter(t => {
        if (!t) return false;
        if (q) {
            const match = (t.title + ' ' + t.artist + ' ' + t.genre).toLowerCase().includes(q);
            if (!match) return false;
        }
        if (region && sampleData[currentCountryCode] && sampleData[currentCountryCode].region !== region) return false;
        return true;
    });

    if (filtered.length === 0) {
        trackListEl.innerHTML = '<li class="muted">No tracks match your search or filters.</li>';
        return;
    }

    filtered.forEach((t, idx) => {
        const li = document.createElement('li');
        li.dataset.index = currentPlaylist.indexOf(t);
        li.innerHTML = `<div>
                      <strong>${t.title}</strong>
                      <div class="track-meta">${t.artist} • ${t.genre}</div>
                    </div>
                    <div><button class="play-small">▶</button></div>`;
        li.querySelector('.play-small').addEventListener('click', (ev) => {
            ev.stopPropagation();
            selectTrack(currentPlaylist.indexOf(t));
            playAudio();
        });
        li.addEventListener('click', () => {
            selectTrack(currentPlaylist.indexOf(t));
        });
        if (currentIndex === currentPlaylist.indexOf(t)) {
            li.style.background = 'rgba(29,185,84,0.06)';
        }
        trackListEl.appendChild(li);
    });
}

// ---------- player controls ----------
function selectTrack(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    currentIndex = index;
    const t = currentPlaylist[currentIndex];
    audio.src = t.src;
    playerTrackEl.textContent = `${t.title} — ${t.artist}`;
    // update UI selection
    renderTrackList();
}

function playAudio() {
    if (!audio.src) return;
    audio.play();
    playPauseBtn.textContent = '⏸';
}
function pauseAudio() {
    audio.pause();
    playPauseBtn.textContent = '▶️';
}
function stopAudio() {
    audio.pause();
    audio.currentTime = 0;
    playPauseBtn.textContent = '▶️';
}
playPauseBtn.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) playAudio(); else pauseAudio();
});
stopBtn.addEventListener('click', stopAudio);

prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) selectTrack(currentIndex - 1);
    else if (currentPlaylist.length) selectTrack(currentPlaylist.length - 1);
    playAudio();
});
nextBtn.addEventListener('click', () => {
    if (currentIndex < currentPlaylist.length - 1) selectTrack(currentIndex + 1);
    else if (currentPlaylist.length) selectTrack(0);
    playAudio();
});

// audio events
audio.addEventListener('loadedmetadata', () => {
    const d = audio.duration || 0;
    durationEl.textContent = formatTime(d);
    seek.max = Math.floor(d);
});
audio.addEventListener('timeupdate', () => {
    currentTimeEl.textContent = formatTime(audio.currentTime);
    if (!seek.dragging) seek.value = Math.floor(audio.currentTime);
});
audio.addEventListener('ended', () => {
    // auto-next
    if (currentIndex < currentPlaylist.length - 1) {
        selectTrack(currentIndex + 1);
        playAudio();
    } else {
        stopAudio();
    }
});

function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    const m = Math.floor(sec / 60);
    return `${m}:${s}`;
}

// seek handling
seek.addEventListener('input', () => {
    audio.currentTime = seek.value;
    currentTimeEl.textContent = formatTime(seek.value);
});
seek.addEventListener('mousedown', () => seek.dragging = true);
seek.addEventListener('mouseup', () => { seek.dragging = false; });

// ---------- search & filter ----------
let searchDebounce = null;
searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderTrackList, 220);
});
regionFilter.addEventListener('change', renderTrackList);

// ---------- small helpers ----------
function safeLog() { if (window.console) console.log.apply(console, arguments); }

// ---------- startup ----------
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    // initial placeholder playlist if you want
    countryNameEl.textContent = 'Click a country to explore indie tracks';
    trackListEl.innerHTML = '<li class="muted">Select a country on the map.</li>';
});
// === GLOBAL MUSIC EXPLORER ===

// Leaflet map setup
const map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// --- SONG DATABASE ---
const musicData = {
    India: [
        { artist: "Arijit Singh", title: "Kesariya", genre: "Bollywood", src: "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav" },
        { artist: "Ritviz", title: "Udd Gaye", genre: "Indie", src: "https://www2.cs.uic.edu/~i101/SoundFiles/PinkPanther60.wav" }
    ],
    USA: [
        { artist: "Billie Eilish", title: "Bad Guy", genre: "Pop", src: "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav" },
        { artist: "Imagine Dragons", title: "Believer", genre: "Rock", src: "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav" }
    ],
    France: [
        { artist: "Stromae", title: "Alors On Danse", genre: "Electro", src: "https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav" },
        { artist: "Christine and the Queens", title: "Tilted", genre: "Pop", src: "https://www2.cs.uic.edu/~i101/SoundFiles/Fanfare60.wav" }
    ],
    Japan: [
        { artist: "YOASOBI", title: "Yoru ni Kakeru", genre: "J-Pop", src: "https://www2.cs.uic.edu/~i101/SoundFiles/Trumpet60.wav" },
        { artist: "Aimer", title: "Zankyou Sanka", genre: "Anime", src: "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav" }
    ]
};

// --- INTERACTION ---
let currentCountry = null;
let currentTrack = 0;

// Create markers
Object.keys(musicData).forEach(country => {
    const marker = L.circleMarker(getCountryCoords(country), {
        radius: 8,
        fillColor: "#66fcf1",
        color: "#45a29e",
        weight: 1,
        fillOpacity: 0.8
    }).addTo(map);

    marker.on("click", () => showCountryMusic(country));
});

// Get coordinates for each country (simplified)
function getCountryCoords(name) {
    const coords = {
        India: [20.5937, 78.9629],
        USA: [37.0902, -95.7129],
        France: [46.6034, 1.8883],
        Japan: [36.2048, 138.2529]
    };
    return coords[name] || [0, 0];
}

// Show music list for selected country
function showCountryMusic(country) {
    currentCountry = country;
    const tracks = musicData[country];
    const list = document.getElementById("trackList");
    const countryName = document.getElementById("countryName");
    const meta = document.getElementById("countryMeta");

    countryName.textContent = country;
    meta.textContent = `Top Artists from ${country}`;
    list.innerHTML = "";

    tracks.forEach((track, index) => {
        const li = document.createElement("li");
        li.textContent = `${track.artist} — ${track.title} (${track.genre})`;
        li.addEventListener("click", () => playTrack(index));
        list.appendChild(li);
    });
}

// Audio player
const audio = document.getElementById("audio");
const playPauseBtn = document.getElementById("playPauseBtn");
const stopBtn = document.getElementById("stopBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const playerTrack = document.getElementById("playerTrack");

playPauseBtn.addEventListener("click", togglePlay);
stopBtn.addEventListener("click", stopMusic);
nextBtn.addEventListener("click", nextTrack);
prevBtn.addEventListener("click", prevTrack);

function playTrack(index) {
    const track = musicData[currentCountry][index];
    if (!track) return;

    currentTrack = index;
    audio.src = track.src;
    audio.play();
    playerTrack.textContent = `🎵 ${track.artist} - ${track.title}`;
    playPauseBtn.textContent = "⏸";
}

function togglePlay() {
    if (audio.paused) {
        audio.play();
        playPauseBtn.textContent = "⏸";
    } else {
        audio.pause();
        playPauseBtn.textContent = "▶️";
    }
}

function stopMusic() {
    audio.pause();
    audio.currentTime = 0;
    playPauseBtn.textContent = "▶️";
}

function nextTrack() {
    const tracks = musicData[currentCountry];
    currentTrack = (currentTrack + 1) % tracks.length;
    playTrack(currentTrack);
}

function prevTrack() {
    const tracks = musicData[currentCountry];
    currentTrack = (currentTrack - 1 + tracks.length) % tracks.length;
    playTrack(currentTrack);
}
