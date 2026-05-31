const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  members: path.join(DATA_DIR, 'members.json'),
  events: path.join(DATA_DIR, 'events.json'),
  albums: path.join(DATA_DIR, 'albums.json'),
  posts: path.join(DATA_DIR, 'posts.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const defaults = {
    members: [], events: [], albums: [], posts: [],
    settings: {
      className: 'Lớp 12A1', school: 'Trường THPT ...',
      coverPhoto: '', groupPhoto: '',
      description: 'Chào mừng đến với trang web lớp chúng mình! 🎓',
      adminPassword: 'admin123', graduationDate: '2025-06-15',
    },
  };
  for (const [key, file] of Object.entries(FILES)) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaults[key], null, 2));
  }
}

function readData(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || req.query.folder || 'photos';
    const dir = path.join(__dirname, 'public/uploads', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E6);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/api/settings', (req, res) => {
  const s = readData(FILES.settings);
  const safe = { ...s }; delete safe.adminPassword; res.json(safe);
});
app.put('/api/settings', (req, res) => {
  const s = readData(FILES.settings);
  const { adminPassword, ...rest } = req.body;
  const merged = { ...s, ...rest };
  if (adminPassword) merged.adminPassword = adminPassword;
  writeData(FILES.settings, merged); res.json({ ok: true });
});
app.post('/api/auth', (req, res) => {
  const s = readData(FILES.settings);
  if (req.body.password === s.adminPassword) res.json({ ok: true });
  else res.status(401).json({ ok: false, message: 'Sai mật khẩu' });
});

app.get('/api/members', (req, res) => res.json(readData(FILES.members)));
app.post('/api/members', (req, res) => {
  const members = readData(FILES.members);
  const member = { id: Date.now().toString(), ...req.body, attendance: {}, createdAt: new Date().toISOString() };
  members.push(member); writeData(FILES.members, members); res.json(member);
});

// Điểm danh: POST /api/members/:id/attendance  body: { date, present }
app.post('/api/members/:id/attendance', (req, res) => {
  const members = readData(FILES.members);
  const idx = members.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (!members[idx].attendance) members[idx].attendance = {};
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  members[idx].attendance[date] = req.body.present;
  writeData(FILES.members, members); res.json({ ok: true });
});

// Bulk điểm danh một ngày: POST /api/attendance body: { date, records: [{id, present}] }
app.post('/api/attendance', (req, res) => {
  const members = readData(FILES.members);
  const { date, records } = req.body;
  const d = date || new Date().toISOString().slice(0, 10);
  for (const rec of (records || [])) {
    const idx = members.findIndex(m => m.id === rec.id);
    if (idx !== -1) {
      if (!members[idx].attendance) members[idx].attendance = {};
      members[idx].attendance[d] = rec.present;
    }
  }
  writeData(FILES.members, members); res.json({ ok: true });
});
app.put('/api/members/:id', (req, res) => {
  const members = readData(FILES.members);
  const idx = members.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  members[idx] = { ...members[idx], ...req.body };
  writeData(FILES.members, members); res.json(members[idx]);
});
app.delete('/api/members/:id', (req, res) => {
  let members = readData(FILES.members).filter(m => m.id !== req.params.id);
  writeData(FILES.members, members); res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  res.json(readData(FILES.events).sort((a, b) => new Date(a.date) - new Date(b.date)));
});
app.post('/api/events', (req, res) => {
  const events = readData(FILES.events);
  const event = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  events.push(event); writeData(FILES.events, events); res.json(event);
});
app.delete('/api/events/:id', (req, res) => {
  writeData(FILES.events, readData(FILES.events).filter(e => e.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/albums', (req, res) => res.json(readData(FILES.albums)));
app.post('/api/albums', (req, res) => {
  const albums = readData(FILES.albums);
  const album = { id: Date.now().toString(), photos: [], videos: [], ...req.body, createdAt: new Date().toISOString() };
  albums.push(album); writeData(FILES.albums, albums); res.json(album);
});
app.delete('/api/albums/:id', (req, res) => {
  writeData(FILES.albums, readData(FILES.albums).filter(a => a.id !== req.params.id));
  res.json({ ok: true });
});
app.post('/api/albums/:id/photos', upload.array('photos', 50), (req, res) => {
  const albums = readData(FILES.albums);
  const idx = albums.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const eventTag = req.body.eventTag || '';
  const newPhotos = req.files.map(f => ({
    id: Date.now().toString() + Math.random(),
    url: `/uploads/photos/${f.filename}`, caption: '',
    eventTag: eventTag || undefined,
    uploadedAt: new Date().toISOString(),
  }));
  if (!albums[idx].photos) albums[idx].photos = [];
  albums[idx].photos.push(...newPhotos);
  writeData(FILES.albums, albums); res.json(newPhotos);
});
app.post('/api/albums/:id/videos', upload.single('video'), (req, res) => {
  const albums = readData(FILES.albums);
  const idx = albums.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const video = {
    id: Date.now().toString(),
    url: req.file ? `/uploads/photos/${req.file.filename}` : null,
    youtubeUrl: req.body.youtubeUrl || null,
    title: req.body.title || 'Video kỷ niệm', uploadedAt: new Date().toISOString(),
  };
  if (!albums[idx].videos) albums[idx].videos = [];
  albums[idx].videos.push(video);
  writeData(FILES.albums, albums); res.json(video);
});
app.delete('/api/albums/:albumId/photos/:photoId', (req, res) => {
  const albums = readData(FILES.albums);
  const idx = albums.findIndex(a => a.id === req.params.albumId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  albums[idx].photos = (albums[idx].photos || []).filter(p => p.id !== req.params.photoId);
  writeData(FILES.albums, albums); res.json({ ok: true });
});

app.get('/api/posts', (req, res) => {
  res.json(readData(FILES.posts).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
app.post('/api/posts', upload.array('images', 10), (req, res) => {
  const posts = readData(FILES.posts);
  const images = (req.files || []).map(f => `/uploads/photos/${f.filename}`);
  const post = {
    id: Date.now().toString(), title: req.body.title, content: req.body.content,
    images, pinned: req.body.pinned === 'true', createdAt: new Date().toISOString(),
  };
  posts.push(post); writeData(FILES.posts, posts); res.json(post);
});
app.delete('/api/posts/:id', (req, res) => {
  writeData(FILES.posts, readData(FILES.posts).filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/upload/cover', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/photos/${req.file.filename}`;
  const s = readData(FILES.settings); s.coverPhoto = url;
  writeData(FILES.settings, s); res.json({ url });
});
app.post('/api/upload/group', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/photos/${req.file.filename}`;
  const s = readData(FILES.settings); s.groupPhoto = url;
  writeData(FILES.settings, s); res.json({ url });
});
app.post('/api/upload/avatar/:memberId', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/avatars/${req.file.filename}`;
  const members = readData(FILES.members);
  const idx = members.findIndex(m => m.id === req.params.memberId);
  if (idx !== -1) { members[idx].avatar = url; writeData(FILES.members, members); }
  res.json({ url });
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

initData();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎓 Website lớp học đang chạy!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://<IP-máy-bạn>:${PORT}`);
  console.log(`\n   Tìm IP: ipconfig\n`);
});