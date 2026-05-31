let isAdmin=false, currentAlbumPhotos=[], lightboxIdx=0, allMembers=[], currentYearFilter=null;

function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  const m={home:0,albums:1,members:2,timeline:3};
  if(m[id]!==undefined) document.querySelectorAll('.nav-link')[m[id]].classList.add('active');
  if(id==='home')loadHome();
  if(id==='albums')loadAlbums();
  if(id==='members')loadMembers();
  if(id==='timeline')loadTimeline();
  if(id==='admin')loadAdmin();
  window.scrollTo(0,0);
}
function toast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast show '+type;
  setTimeout(()=>t.className='toast',3000);
}
async function get(url){const r=await fetch(url);return r.json();}
async function post(url,data){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json();}
async function put(url,data){const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json();}
async function del(url){const r=await fetch(url,{method:'DELETE'});return r.json();}
async function uploadForm(url,fd){const r=await fetch(url,{method:'POST',body:fd});return r.json();}

function updateCountdown(target){
  const diff=new Date(target)-new Date();
  if(diff<=0){['cdDays','cdHours','cdMins','cdSecs'].forEach(id=>document.getElementById(id).textContent='0');document.getElementById('countdownLabel').textContent='🎓 Đã tốt nghiệp!';return;}
  document.getElementById('cdDays').textContent=Math.floor(diff/86400000);
  document.getElementById('cdHours').textContent=String(Math.floor(diff%86400000/3600000)).padStart(2,'0');
  document.getElementById('cdMins').textContent=String(Math.floor(diff%3600000/60000)).padStart(2,'0');
  document.getElementById('cdSecs').textContent=String(Math.floor(diff%60000/1000)).padStart(2,'0');
}

// ====== TRANG CHỦ ======
async function loadHome(){
  const[s,posts,events]=await Promise.all([get('/api/settings'),get('/api/posts'),get('/api/events')]);
  document.title=s.className+' - Website Lớp';
  document.getElementById('navBrand').textContent='🎓 '+s.className;
  document.getElementById('heroTitle').textContent=s.className;
  document.getElementById('heroSchool').textContent=s.school;
  document.getElementById('heroDesc').textContent=s.description;
  if(s.groupPhoto){document.getElementById('heroBgImg').style.cssText=`background-image:url(${s.groupPhoto});opacity:0.45`;}
  else if(s.coverPhoto){document.getElementById('heroBgImg').style.cssText=`background-image:url(${s.coverPhoto});opacity:0.45`;}
  if(s.graduationDate){updateCountdown(s.graduationDate);setInterval(()=>updateCountdown(s.graduationDate),1000);}
  const upcoming=events.filter(e=>new Date(e.date)>new Date()).slice(0,5);
  if(upcoming.length){document.getElementById('upcomingStrip').style.display='flex';document.getElementById('upcomingItems').innerHTML=upcoming.map(e=>`<div class="upcoming-item"><div class="upcoming-dot"></div><div><div class="upcoming-text">${e.title}</div><div class="upcoming-date">${fmtDate(e.date)}</div></div></div>`).join('');}

  // Load video 3 năm
  loadYearVideos(s);

  const sorted=[...posts].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||new Date(b.createdAt)-new Date(a.createdAt));
  const grid=document.getElementById('postsGrid');
  grid.innerHTML=sorted.length?sorted.map(p=>`<div class="post-card">${p.images&&p.images[0]?`<img class="post-card-img" src="${p.images[0]}" alt="">`:' <div class="post-card-img-placeholder">📰</div>'}<div class="post-card-body">${p.pinned?'<div class="pinned-badge">📌 Ghim</div>':''}<div class="post-card-title">${p.title}</div><div class="post-card-text">${p.content.substring(0,150)}${p.content.length>150?'...':''}</div><div class="post-card-date">${fmtDate(p.createdAt)}</div></div></div>`).join(''):'<div class="empty-state" style="grid-column:1/-1"><div class="icon">📝</div><p>Chưa có bài viết nào.</p></div>';
}

function loadYearVideos(s){
  const years=[10,11,12];
  const vids=s.yearVideos||{};
  years.forEach(yr=>{
    const wrap=document.getElementById('yvWrap'+yr);
    if(!wrap)return;
    const data=vids[yr];
    if(data&&data.url){
      const match=data.url.match(/(?:v=|youtu\.be\/)([^&?]+)/);
      if(match){
        wrap.innerHTML=`<div style="position:relative;padding-bottom:56.25%;height:0"><iframe src="https://www.youtube.com/embed/${match[1]}" style="position:absolute;inset:0;width:100%;height:100%;border:none;border-radius:12px" allowfullscreen></iframe></div>${data.title?`<div class="year-video-title">${data.title}</div>`:''}`;
        return;
      }
    }
    wrap.innerHTML=`<div class="year-video-placeholder"><div style="font-size:2.5rem">🎬</div><p>Chưa có video năm ${yr}</p><p style="font-size:0.75rem;opacity:0.7">Thêm từ trang Quản trị → Timeline</p></div>`;
  });
}

// ====== ALBUM ẢNH ======
let allAlbums=[];
async function loadAlbums(){
  allAlbums=await get('/api/albums');
  renderAlbums(allAlbums);
}

function renderAlbums(albums){
  const grid=document.getElementById('albumsGrid');
  // Highlight active year node
  [10,11,12].forEach(yr=>{
    const node=document.getElementById('yn'+yr);
    if(node) node.classList.toggle('active', String(currentYearFilter)===String(yr));
  });
  const label=document.getElementById('yearFilterLabel');
  const clearBtn=document.getElementById('clearYearFilter');
  if(currentYearFilter){
    label.textContent=`Đang xem: Năm ${currentYearFilter}`;
    if(clearBtn){clearBtn.style.display='block';}
  } else {
    label.textContent='Tất cả năm học';
    if(clearBtn){clearBtn.style.display='none';}
  }

  let filtered=currentYearFilter?albums.filter(a=>String(a.year)===String(currentYearFilter)):albums;
  // Sort: by year then by event date or created
  filtered=[...filtered].sort((a,b)=>{
    const ya=Number(a.year)||0, yb=Number(b.year)||0;
    if(ya!==yb) return ya-yb;
    return new Date(a.createdAt)-new Date(b.createdAt);
  });

  if(!filtered.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="icon">🖼</div><p>Chưa có album nào.</p></div>';return;}
  grid.innerHTML=filtered.map(a=>{
    const cover=a.photos&&a.photos[0]?a.photos[0].url:'';
    const cnt=(a.photos||[]).length+(a.videos||[]).length;
    const yearLabel=a.year?`<div class="album-year-badge">Năm ${a.year}</div>`:'';
    const eventLabel=a.event?`<div class="album-event-tag">📌 ${a.event}</div>`:'';
    return `<div class="album-card" onclick="openAlbum('${a.id}')"><div class="album-cover">${cover?`<img src="${cover}" alt="">`:' 📷'}${yearLabel}</div><div class="album-info">${eventLabel}<div class="album-name">${a.name}</div><div class="album-count">${cnt} mục</div></div></div>`;
  }).join('');
}

function filterAlbumYear(yr){
  currentYearFilter=yr;
  renderAlbums(allAlbums);
}

async function openAlbum(id){
  const a=allAlbums.find(x=>x.id===id); if(!a)return;
  currentAlbumPhotos=a.photos||[];

  // Group photos by event/milestone
  let html=`<div class="overlay-title">${a.name}</div>`;
  if(a.year) html+=`<p style="color:var(--gold);font-size:0.8rem;margin-bottom:4px">📚 Năm học ${a.year}</p>`;
  if(a.event) html+=`<p style="color:var(--brown);font-size:0.85rem;margin-bottom:16px">📌 ${a.event}</p>`;
  if(a.description) html+=`<p style="color:var(--text-muted);margin-bottom:24px">${a.description}</p>`;

  if(currentAlbumPhotos.length){
    // Group by event tag if photos have it
    const groups={};
    currentAlbumPhotos.forEach((p,i)=>{
      const key=p.eventTag||'__none__';
      if(!groups[key]) groups[key]=[];
      groups[key].push({...p,_idx:i});
    });
    const keys=Object.keys(groups);
    if(keys.length===1&&keys[0]==='__none__'){
      html+=`<h4 style="color:var(--brown);margin-bottom:16px">📸 Ảnh (${currentAlbumPhotos.length})</h4><div class="photos-grid">`;
      html+=currentAlbumPhotos.map((p,i)=>`<div class="photo-thumb" onclick="openLightbox(${i})"><img src="${p.url}" alt="" loading="lazy">${p.caption?`<div class="photo-caption">${p.caption}</div>`:''}</div>`).join('');
      html+=`</div>`;
    } else {
      keys.forEach(key=>{
        if(key!=='__none__') html+=`<div class="photo-group-header">📌 ${key}</div>`;
        else html+=`<div class="photo-group-header" style="opacity:0.5">Ảnh khác</div>`;
        html+=`<div class="photos-grid">`;
        html+=groups[key].map(p=>`<div class="photo-thumb" onclick="openLightbox(${p._idx})"><img src="${p.url}" alt="" loading="lazy"></div>`).join('');
        html+=`</div>`;
      });
    }
  }

  if(a.videos&&a.videos.length){
    html+=`<h4 style="color:var(--brown);margin:24px 0 16px">🎬 Video (${a.videos.length})</h4><div class="videos-list">`;
    html+=a.videos.map(v=>{
      let embed='';
      if(v.youtubeUrl){const yt=v.youtubeUrl.match(/(?:v=|youtu\.be\/)([^&?]+)/);if(yt)embed=`<iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe>`;}
      else if(v.url) embed=`<video src="${v.url}" controls></video>`;
      return `<div class="video-item">${embed}<div class="video-title">${v.title}</div></div>`;
    }).join('')+'</div>';
  }
  if(!currentAlbumPhotos.length&&!(a.videos&&a.videos.length)) html+='<div class="empty-state"><div class="icon">📭</div><p>Album chưa có ảnh hay video nào.</p></div>';
  document.getElementById('albumOverlayContent').innerHTML=html;
  document.getElementById('albumOverlay').classList.add('active');
}
function closeAlbum(){document.getElementById('albumOverlay').classList.remove('active');}
function openLightbox(idx){lightboxIdx=idx;document.getElementById('lightboxImg').src=currentAlbumPhotos[idx].url;document.getElementById('lightbox').classList.add('active');}
function closeLightbox(){document.getElementById('lightbox').classList.remove('active');}
function lightboxNav(dir){lightboxIdx=(lightboxIdx+dir+currentAlbumPhotos.length)%currentAlbumPhotos.length;document.getElementById('lightboxImg').src=currentAlbumPhotos[lightboxIdx].url;}
document.getElementById('lightbox').addEventListener('click',e=>{if(e.target===e.currentTarget)closeLightbox();});
document.addEventListener('keydown',e=>{if(!document.getElementById('lightbox').classList.contains('active'))return;if(e.key==='ArrowLeft')lightboxNav(-1);if(e.key==='ArrowRight')lightboxNav(1);if(e.key==='Escape')closeLightbox();});

// ====== THÀNH VIÊN ======
async function loadMembers(){
  allMembers=await get('/api/members'); filterMembers();
  const now=new Date();
  const bMonth=allMembers.filter(m=>m.birthday&&new Date(m.birthday).getMonth()===now.getMonth());
  const bSec=document.getElementById('birthdaySection');
  if(bMonth.length){bSec.style.display='block';document.getElementById('birthdayGrid').innerHTML=bMonth.map(m=>memberCard(m,true)).join('');}
  else bSec.style.display='none';
}
function filterMembers(){
  const q=(document.getElementById('memberSearch')||{}).value?.toLowerCase()||'';
  const toFilter=(document.getElementById('memberToFilter')||{}).value||'';
  let filtered=allMembers;
  if(q) filtered=filtered.filter(m=>m.name.toLowerCase().includes(q));
  if(toFilter) filtered=filtered.filter(m=>String(m.to)===String(toFilter));
  renderMembers(filtered);
}
function renderMembers(members){
  const grid=document.getElementById('membersGrid');
  if(!members.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="icon">👥</div><p>Không tìm thấy thành viên.</p></div>';return;}
  const roles={'GVCN':0,'Lớp trưởng':1,'Lớp phó':2,'Bí thư':3};
  grid.innerHTML=[...members].sort((a,b)=>(roles[a.role]??9)-(roles[b.role]??9)||a.name.localeCompare(b.name)).map(m=>memberCard(m)).join('');
}
function memberCard(m,hl=false){
  const now=new Date(), bday=m.birthday?new Date(m.birthday):null;
  const soon=bday&&bday.getMonth()===now.getMonth()&&Math.abs(bday.getDate()-now.getDate())<=7;
  const init=m.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  return `<div class="member-card"${hl?' style="border:2px solid var(--gold)"':''}>
    ${m.social?`<a href="${m.social}" target="_blank" style="text-decoration:none">`:''}
    <div class="member-avatar">${m.avatar?`<img src="${m.avatar}" alt="">`:init}</div>
    ${m.social?'</a>':''}
    <div class="member-name">${m.name}</div>
    ${m.role?`<div class="member-role">${m.role}</div>`:''}
    ${m.to?`<div class="member-to">Tổ ${m.to}</div>`:''}
    ${m.phone?`<div class="member-phone">📞 ${m.phone}</div>`:''}
    ${bday?`<div class="member-bday">🎂 ${fmtBday(m.birthday)}</div>`:''}
    ${m.note?`<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;font-style:italic">"${m.note}"</div>`:''}
    ${soon?'<div class="birthday-soon">🎉 Sinh nhật gần rồi!</div>':''}
  </div>`;
}

// ====== ĐIỂM DANH ======
let attendanceDate='', attendanceRecords={};
function showAttendanceModal(){
  const today=new Date().toISOString().slice(0,10);
  attendanceDate=today;
  renderAttendanceModal();
  document.getElementById('attendanceOverlay').classList.add('active');
}
function closeAttendance(){document.getElementById('attendanceOverlay').classList.remove('active');}
function renderAttendanceModal(){
  const sorted=[...allMembers].sort((a,b)=>{
    const ta=a.to?Number(a.to):99, tb=b.to?Number(b.to):99;
    if(ta!==tb) return ta-tb;
    return a.name.localeCompare(b.name);
  });
  // Init records for today
  sorted.forEach(m=>{
    if(attendanceRecords[m.id]===undefined){
      attendanceRecords[m.id]=(m.attendance&&m.attendance[attendanceDate])??true;
    }
  });
  const present=Object.values(attendanceRecords).filter(v=>v).length;
  const absent=Object.values(attendanceRecords).filter(v=>!v).length;
  let rows='';
  let lastTo='';
  sorted.forEach(m=>{
    if(m.to&&String(m.to)!==lastTo){rows+=`<tr style="background:var(--warm)"><td colspan="3" style="font-weight:600;color:var(--brown);padding:8px 12px">Tổ ${m.to}</td></tr>`;lastTo=String(m.to);}
    const isPresent=attendanceRecords[m.id]!==false;
    rows+=`<tr>
      <td>${m.name}${m.role?`<span style="font-size:0.75rem;color:var(--gold);margin-left:6px">${m.role}</span>`:''}</td>
      <td style="text-align:center">
        <button onclick="toggleAttendance('${m.id}',true)" class="att-btn ${isPresent?'att-present':''}" title="Có mặt">✓</button>
        <button onclick="toggleAttendance('${m.id}',false)" class="att-btn ${!isPresent?'att-absent':''}" title="Vắng">✗</button>
      </td>
      <td style="font-size:0.8rem;color:${isPresent?'var(--green)':'var(--rose)'}">${isPresent?'Có mặt':'Vắng'}</td>
    </tr>`;
  });
  document.getElementById('attendanceContent').innerHTML=`
    <h2 style="font-family:'Playfair Display',serif;color:var(--brown);margin-bottom:8px">📋 Điểm danh</h2>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:20px">
      <input type="date" value="${attendanceDate}" onchange="changeAttendanceDate(this.value)" style="padding:8px 12px;border:1.5px solid var(--gold-light);border-radius:10px;font-family:inherit;background:var(--cream)">
      <div style="display:flex;gap:12px">
        <span style="background:var(--green);color:#fff;padding:4px 12px;border-radius:20px;font-size:0.85rem">✓ Có mặt: ${present}</span>
        <span style="background:var(--rose);color:#fff;padding:4px 12px;border-radius:20px;font-size:0.85rem">✗ Vắng: ${absent}</span>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="markAll(true)">Tất cả có mặt</button>
        <button class="btn btn-secondary btn-sm" onclick="markAll(false)">Tất cả vắng</button>
      </div>
    </div>
    <table class="data-table" style="margin-bottom:20px">
      <thead><tr><th>Họ tên</th><th style="width:100px;text-align:center">Điểm danh</th><th style="width:100px">Trạng thái</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <button class="btn btn-primary" onclick="saveAttendance()" style="width:100%">💾 Lưu điểm danh</button>
  `;
}
function toggleAttendance(id,present){
  attendanceRecords[id]=present;
  renderAttendanceModal();
}
function markAll(present){
  allMembers.forEach(m=>attendanceRecords[m.id]=present);
  renderAttendanceModal();
}
function changeAttendanceDate(d){
  attendanceDate=d;
  attendanceRecords={};
  allMembers.forEach(m=>{attendanceRecords[m.id]=(m.attendance&&m.attendance[d])??true;});
  renderAttendanceModal();
}
async function saveAttendance(){
  const records=Object.entries(attendanceRecords).map(([id,present])=>({id,present}));
  await post('/api/attendance',{date:attendanceDate,records});
  // Refresh local data
  allMembers=await get('/api/members');
  toast(`Đã lưu điểm danh ngày ${attendanceDate}! ✓`,'success');
  closeAttendance();
}

// ====== TIMELINE ======
async function loadTimeline(){
  const events=await get('/api/events');
  const list=document.getElementById('timelineList');
  if(!events.length){list.innerHTML='<div class="empty-state"><div class="icon">📅</div><p>Chưa có sự kiện nào.</p></div>';return;}
  const now=new Date();
  const bm={trip:'badge-trip',art:'badge-art',grad:'badge-grad',sport:'badge-sport',other:'badge-other'};
  const lm={trip:'✈ Tham quan',art:'🎭 Văn nghệ',grad:'🎓 Tốt nghiệp',sport:'⚽ Thể thao',other:'🌟 Sự kiện'};
  list.innerHTML=events.map(e=>{
    const d=new Date(e.date),past=d<now,future=d>now;
    return `<div class="timeline-item"><div class="timeline-dot ${past?'past':future?'future':''}"></div><div class="timeline-body">
      <div class="event-type-badge ${bm[e.type]||'badge-other'}">${lm[e.type]||'🌟 Sự kiện'}</div>
      <div class="timeline-date">${fmtDate(e.date)}</div>
      <div class="timeline-title">${e.title}</div>
      ${e.description?`<div class="timeline-desc">${e.description}</div>`:''}
      ${e.image?`<img class="timeline-img" src="${e.image}" alt="">` :''}
      ${future?`<div style="margin-top:10px;font-size:0.8rem;color:var(--green);font-weight:500">⏳ Còn ${Math.ceil((d-now)/86400000)} ngày nữa</div>`:''}
    </div></div>`;
  }).join('');
}

// ====== ADMIN ======
async function doLogin(){
  const pw=document.getElementById('adminPwInput').value;
  const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
  if(r.ok){isAdmin=true;document.getElementById('adminLoginBox').style.display='none';document.getElementById('adminPanelBox').style.display='block';document.getElementById('adminBtn').classList.add('active');loadAdminData();}
  else toast('Sai mật khẩu!','error');
}
function adminLogout(){isAdmin=false;document.getElementById('adminLoginBox').style.display='block';document.getElementById('adminPanelBox').style.display='none';document.getElementById('adminBtn').classList.remove('active');document.getElementById('adminPwInput').value='';}
function loadAdmin(){if(isAdmin)loadAdminData();}
async function loadAdminData(){
  const s=await get('/api/settings');
  document.getElementById('s-className').value=s.className||'';
  document.getElementById('s-school').value=s.school||'';
  document.getElementById('s-description').value=s.description||'';
  document.getElementById('s-gradDate').value=s.graduationDate||'';
  // Load year videos vào form
  const vids=s.yearVideos||{};
  [10,11,12].forEach(yr=>{
    const inp=document.getElementById('v-year'+yr);
    const tinp=document.getElementById('v-year'+yr+'-title');
    if(inp) inp.value=(vids[yr]&&vids[yr].url)||'';
    if(tinp) tinp.value=(vids[yr]&&vids[yr].title)||'';
  });
  loadAdminPosts();loadAdminAlbums();loadAdminMembers();loadAdminEvents();
}
function switchTab(id,btn){
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}
async function saveSettings(){
  const data={className:document.getElementById('s-className').value,school:document.getElementById('s-school').value,description:document.getElementById('s-description').value,graduationDate:document.getElementById('s-gradDate').value};
  const pw=document.getElementById('s-password').value; if(pw)data.adminPassword=pw;
  await put('/api/settings',data); toast('Đã lưu cài đặt! ✓','success'); loadHome();
}

// Lưu video 3 năm
async function saveYearVideos(){
  const s=await get('/api/settings');
  const yearVideos=s.yearVideos||{};
  [10,11,12].forEach(yr=>{
    const url=(document.getElementById('v-year'+yr)||{}).value||'';
    const title=(document.getElementById('v-year'+yr+'-title')||{}).value||'';
    yearVideos[yr]={url,title};
  });
  await put('/api/settings',{yearVideos});
  toast('Đã lưu video 3 năm! ✓','success');
  loadHome();
}

async function uploadCover(input){const fd=new FormData();fd.append('photo',input.files[0]);const r=await uploadForm('/api/upload/cover',fd);if(r.url){toast('Đã cập nhật ảnh bìa! ✓','success');loadHome();}}
async function uploadGroup(input){const fd=new FormData();fd.append('photo',input.files[0]);const r=await uploadForm('/api/upload/group',fd);if(r.url){toast('Đã cập nhật ảnh tập thể! ✓','success');loadHome();}}

async function loadAdminPosts(){
  const posts=await get('/api/posts');
  const el=document.getElementById('adminPostsList');
  if(!posts.length){el.innerHTML='<p style="color:var(--text-muted)">Chưa có bài viết nào.</p>';return;}
  el.innerHTML=`<table class="data-table"><thead><tr><th>Tiêu đề</th><th>Ngày</th><th>Ghim</th><th></th></tr></thead><tbody>`+posts.map(p=>`<tr><td><strong>${p.title}</strong></td><td>${fmtDate(p.createdAt)}</td><td>${p.pinned?'📌':''}</td><td><button class="btn btn-danger btn-sm" onclick="deletePost('${p.id}')">Xóa</button></td></tr>`).join('')+`</tbody></table>`;
}
async function addPost(){
  const title=document.getElementById('p-title').value.trim(),content=document.getElementById('p-content').value.trim();
  if(!title||!content)return toast('Vui lòng nhập tiêu đề và nội dung!','error');
  const fd=new FormData();fd.append('title',title);fd.append('content',content);fd.append('pinned',document.getElementById('p-pinned').checked);
  for(let f of document.getElementById('p-images').files)fd.append('images',f);
  await uploadForm('/api/posts',fd); toast('Đã đăng bài viết! ✓','success');
  ['p-title','p-content','p-images'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('p-pinned').checked=false;
  loadAdminPosts();loadHome();
}
async function deletePost(id){if(!confirm('Xóa bài viết này?'))return;await del('/api/posts/'+id);toast('Đã xóa!');loadAdminPosts();loadHome();}

async function loadAdminAlbums(){
  const albums=await get('/api/albums');
  const el=document.getElementById('adminAlbumsList');
  if(!albums.length){el.innerHTML='<p style="color:var(--text-muted)">Chưa có album nào.</p>';return;}
  el.innerHTML=albums.sort((a,b)=>(Number(a.year)||0)-(Number(b.year)||0)||new Date(a.createdAt)-new Date(b.createdAt)).map(a=>{
    const pc=(a.photos||[]).length,vc=(a.videos||[]).length;
    return `<div style="border:1px solid var(--gold-light);border-radius:12px;padding:16px;margin-bottom:16px;background:var(--cream)">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:flex-start">
        <div><strong style="color:var(--brown)">${a.name}</strong> ${a.year?`<span style="font-size:0.8rem;color:var(--gold)">Năm ${a.year}</span>`:''} ${a.event?`<span style="font-size:0.78rem;color:var(--text-muted);margin-left:4px">📌 ${a.event}</span>`:''}<br><small style="color:var(--text-muted)">${pc} ảnh · ${vc} video</small></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openPhotoUploader('${a.id}')">📸 Thêm ảnh</button>
          <button class="btn btn-secondary btn-sm" onclick="openVideoAdder('${a.id}','${a.name}')">🎬 Thêm video</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAlbum('${a.id}')">Xóa album</button>
        </div>
      </div>
      ${a.photos&&a.photos.length?`<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">`+a.photos.slice(0,8).map(p=>`<div style="position:relative"><img src="${p.url}" style="width:70px;height:70px;object-fit:cover;border-radius:8px" alt=""><button onclick="deletePhoto('${a.id}','${p.id}')" style="position:absolute;top:-6px;right:-6px;background:var(--rose);color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer">✕</button></div>`).join('')+(a.photos.length>8?`<div style="width:70px;height:70px;background:var(--warm);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:var(--text-muted)">+${a.photos.length-8}</div>`:'')+`</div>`:''}
    </div>`;
  }).join('');
}
async function addAlbum(){
  const name=document.getElementById('a-name').value.trim();
  if(!name)return toast('Vui lòng nhập tên album!','error');
  const year=document.getElementById('a-year').value;
  const event=document.getElementById('a-event').value.trim();
  await post('/api/albums',{name,year,event,description:document.getElementById('a-desc').value.trim()});
  toast('Đã tạo album! ✓','success');
  ['a-name','a-event','a-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('a-year').value='';
  loadAdminAlbums();loadAlbums();
}
async function deleteAlbum(id){if(!confirm('Xóa album này?'))return;await del('/api/albums/'+id);toast('Đã xóa album!');loadAdminAlbums();loadAlbums();}
async function deletePhoto(albumId,photoId){await del(`/api/albums/${albumId}/photos/${photoId}`);toast('Đã xóa ảnh!');loadAdminAlbums();}
function openPhotoUploader(albumId){
  // Ask for event tag first
  const eventTag=prompt('Mốc sự kiện / nhãn cho ảnh này (để trống nếu không có):\nVD: Khai giảng, Hội trại, 20/11...')||'';
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=true;
  input.onchange=async()=>{
    const fd=new FormData();fd.append('folder','photos');fd.append('eventTag',eventTag);
    for(let f of input.files)fd.append('photos',f);
    const r=await uploadForm(`/api/albums/${albumId}/photos`,fd);
    toast(`Đã thêm ${r.length} ảnh! ✓`,'success');loadAdminAlbums();loadAlbums();
  };
  input.click();
}
function openVideoAdder(albumId,albumName){
  const ytUrl=prompt(`Thêm video vào "${albumName}"\n\nNhập URL YouTube (hoặc bỏ trống để upload file):`);
  if(ytUrl===null)return;
  if(ytUrl.trim()){
    const title=prompt('Tiêu đề video:')||'Video kỷ niệm';
    const fd=new FormData();fd.append('youtubeUrl',ytUrl.trim());fd.append('title',title);
    uploadForm(`/api/albums/${albumId}/videos`,fd).then(()=>{toast('Đã thêm video! ✓','success');loadAdminAlbums();});
  } else {
    const input=document.createElement('input');input.type='file';input.accept='video/*';
    input.onchange=async()=>{const title=prompt('Tiêu đề video:')||'Video kỷ niệm';const fd=new FormData();fd.append('video',input.files[0]);fd.append('title',title);fd.append('folder','photos');await uploadForm(`/api/albums/${albumId}/videos`,fd);toast('Đã tải lên video! ✓','success');loadAdminAlbums();};
    input.click();
  }
}

async function loadAdminMembers(){
  const members=await get('/api/members');
  const tbody=document.getElementById('adminMembersTable');
  if(!members.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Chưa có thành viên nào.</td></tr>';return;}
  tbody.innerHTML=members.map(m=>`<tr>
    <td>${m.avatar?`<img src="${m.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;vertical-align:middle" alt="">`:''}${m.name}</td>
    <td>${m.phone||'—'}</td>
    <td>${m.to?'Tổ '+m.to:'—'}</td>
    <td>${m.birthday?fmtBday(m.birthday):'—'}</td>
    <td>${m.role||'Học sinh'}</td>
    <td style="display:flex;gap:6px">
      <label class="btn btn-secondary btn-sm" style="cursor:pointer">📷<input type="file" accept="image/*" style="display:none" onchange="uploadAvatar('${m.id}',this)"></label>
      <button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}')">Xóa</button>
    </td>
  </tr>`).join('');
}
async function addMember(){
  const name=document.getElementById('m-name').value.trim();
  if(!name)return toast('Vui lòng nhập họ tên!','error');
  await post('/api/members',{name,role:document.getElementById('m-role').value,birthday:document.getElementById('m-birthday').value,phone:document.getElementById('m-phone').value,to:document.getElementById('m-to').value,social:document.getElementById('m-social').value,note:document.getElementById('m-note').value});
  toast('Đã thêm thành viên! ✓','success');
  ['m-name','m-birthday','m-social','m-note','m-phone'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('m-role').value='';
  document.getElementById('m-to').value='';
  loadAdminMembers();
}
async function deleteMember(id){if(!confirm('Xóa thành viên này?'))return;await del('/api/members/'+id);toast('Đã xóa!');loadAdminMembers();}
async function uploadAvatar(memberId,input){const fd=new FormData();fd.append('avatar',input.files[0]);fd.append('folder','avatars');await uploadForm(`/api/upload/avatar/${memberId}`,fd);toast('Đã cập nhật avatar! ✓','success');loadAdminMembers();}

async function loadAdminEvents(){
  const events=await get('/api/events');
  const el=document.getElementById('adminEventsList');
  if(!events.length){el.innerHTML='<p style="color:var(--text-muted)">Chưa có sự kiện nào.</p>';return;}
  el.innerHTML=`<table class="data-table"><thead><tr><th>Sự kiện</th><th>Ngày</th><th>Loại</th><th></th></tr></thead><tbody>`+events.map(e=>`<tr><td><strong>${e.title}</strong></td><td>${fmtDate(e.date)}</td><td>${e.type||'other'}</td><td><button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}')">Xóa</button></td></tr>`).join('')+`</tbody></table>`;
}
async function addEvent(){
  const title=document.getElementById('e-title').value.trim(),date=document.getElementById('e-date').value;
  if(!title||!date)return toast('Vui lòng nhập tên và ngày!','error');
  await post('/api/events',{title,date,type:document.getElementById('e-type').value,description:document.getElementById('e-desc').value,image:document.getElementById('e-img').value});
  toast('Đã thêm sự kiện! ✓','success');
  ['e-title','e-date','e-desc','e-img'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('e-type').value='other';
  loadAdminEvents();loadTimeline();
}
async function deleteEvent(id){if(!confirm('Xóa sự kiện này?'))return;await del('/api/events/'+id);toast('Đã xóa!');loadAdminEvents();loadTimeline();}

function fmtDate(d){if(!d)return'';return new Date(d).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});}
function fmtBday(d){if(!d)return'';const dt=new Date(d);return`${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;}

loadHome();