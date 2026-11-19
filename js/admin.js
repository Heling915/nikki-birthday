import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function isAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData.session?.user?.email;
  if (!email) return false;
  const { data } = await supabase
    .from("admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

function isAmrUrl(url) {
  return /\.amr($|\?)/i.test(url || "");
}

function createAmrPlayer(url) {
  const wrap = document.createElement("div");
  wrap.className = "amr-player";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "amr-play";
  btn.textContent = "播放录音";

  let amr = null;
  btn.addEventListener("click", () => {
    if (!amr) {
      btn.disabled = true;
      btn.textContent = "加载中…";
      amr = new window.BenzAMRRecorder();
      amr.onEnded(() => {
        btn.textContent = "播放录音";
      });
      amr
        .initWithUrl(url)
        .then(() => {
          btn.disabled = false;
          btn.textContent = "停止";
          amr.play();
        })
        .catch(() => {
          btn.disabled = false;
          btn.textContent = "播放失败";
        });
      return;
    }
    if (amr.isPlaying()) {
      amr.stop();
      btn.textContent = "播放录音";
    } else {
      amr.play();
      btn.textContent = "停止";
    }
  });

  wrap.appendChild(btn);
  return wrap;
}

function createAudioPlayer(url) {
  if (isAmrUrl(url)) return createAmrPlayer(url);
  const a = document.createElement("audio");
  a.controls = true;
  a.src = url;
  a.className = "card-audio";
  return a;
}

const STATUS_TEXT = { pending: "待审核", passed: "已通过", rejected: "已驳回" };

let currentFilter = "pending";
let pendingList = [];
let passedList = [];
let rejectedList = [];
let allVideos = [];
let currentSection = "bless";

const loginView = document.getElementById("loginView");
const panelView = document.getElementById("panelView");

function showLogin() {
  loginView.classList.remove("hidden");
  panelView.classList.add("hidden");
}

function showPanel() {
  loginView.classList.add("hidden");
  panelView.classList.remove("hidden");
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const err = document.getElementById("loginError");
  err.classList.add("hidden");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    err.textContent = "登录失败：" + error.message;
    err.classList.remove("hidden");
    return;
  }

  if (!(await isAdmin())) {
    await supabase.auth.signOut();
    err.textContent = "该账号没有管理员权限";
    err.classList.remove("hidden");
    return;
  }

  document.getElementById("loginForm").reset();
  showPanel();
  await loadBlessings();
});

document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentFilter = "pending";
  pendingList = [];
  passedList = [];
  rejectedList = [];
  showLogin();
});

let statsCounts = { pending: 0, passed: 0, rejected: 0 };

async function loadBlessings() {
  const [pendingRes, passedRes, rejectedRes] = await Promise.all([
    supabase
      .from("bless")
      .select("*")
      .eq("status", "pending")
      .order("create_at", { ascending: false }),
    supabase
      .from("bless")
      .select("*")
      .eq("status", "passed")
      .order("create_at", { ascending: false })
      .limit(50),
    supabase
      .from("bless")
      .select("*")
      .eq("status", "rejected")
      .order("create_at", { ascending: false })
      .limit(50),
  ]);

  if (pendingRes.error || passedRes.error || rejectedRes.error) {
    alert("加载失败：" + (pendingRes.error || passedRes.error || rejectedRes.error).message);
    return;
  }

  pendingList = pendingRes.data || [];
  passedList = passedRes.data || [];
  rejectedList = rejectedRes.data || [];
  await loadStats();
  renderList();
}

async function loadStats() {
  const s = { pending: 0, passed: 0, rejected: 0 };
  for (const status of ["pending", "passed", "rejected"]) {
    const { count } = await supabase
      .from("bless")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    s[status] = count || 0;
  }
  statsCounts = s;
  renderStats();
}

function renderStats() {
  const { pending, passed, rejected } = statsCounts;
  document.getElementById("stats").textContent =
    `待审核 ${pending} · 已通过 ${passed} · 已驳回 ${rejected} · 共 ${pending + passed + rejected}`;
}

function renderList() {
  const list = document.getElementById("list");
  let items;
  if (currentFilter === "pending") items = pendingList;
  else if (currentFilter === "passed") items = passedList;
  else if (currentFilter === "rejected") items = rejectedList;
  else items = [...pendingList, ...passedList, ...rejectedList];

  list.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "暂无数据";
    list.appendChild(empty);
    return;
  }

  for (const b of items) {
    list.appendChild(buildCard(b));
  }
}

function buildCard(b) {
  const card = document.createElement("div");
  card.className = "card";

  const head = document.createElement("div");
  head.className = "card-head";

  const nick = document.createElement("span");
  nick.className = "card-nick";
  nick.textContent = b.nickname;

  const badge = document.createElement("span");
  badge.className = "badge badge-" + b.status;
  badge.textContent = STATUS_TEXT[b.status] || b.status;

  head.append(nick, badge);

  const content = document.createElement("div");
  content.className = "card-content";
  content.textContent = b.content;

  card.append(head, content);

  if (b.photo_url) {
    const img = document.createElement("img");
    img.className = "card-photo";
    img.src = b.photo_url;
    img.alt = "照片";
    img.loading = "lazy";
    img.addEventListener("click", () => window.open(b.photo_url, "_blank"));
    card.appendChild(img);
  }

  if (b.audio_url) {
    card.appendChild(createAudioPlayer(b.audio_url));
  }

  const time = document.createElement("div");
  time.className = "card-time";
  time.textContent = b.create_at ? new Date(b.create_at).toLocaleString("zh-CN") : "";
  card.appendChild(time);

  if (b.reject_reason) {
    const reason = document.createElement("div");
    reason.className = "card-reject-reason";
    reason.textContent = "驳回理由：" + b.reject_reason;
    card.appendChild(reason);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (b.status !== "passed") {
    const approve = document.createElement("button");
    approve.className = "btn-approve";
    approve.textContent = "通过";
    approve.addEventListener("click", () => setStatus(b.id, "passed"));
    actions.appendChild(approve);
  }

  if (b.status !== "rejected") {
    const reject = document.createElement("button");
    reject.className = "btn-reject";
    reject.textContent = "驳回";
    reject.addEventListener("click", () => rejectBless(b.id));
    actions.appendChild(reject);
  }

  const del = document.createElement("button");
  del.className = "btn-delete";
  del.textContent = "删除";
  del.addEventListener("click", () => deleteBless(b.id));
  actions.appendChild(del);

  card.appendChild(actions);
  return card;
}

async function setStatus(id, status) {
  const { error } = await supabase.from("bless").update({ status }).eq("id", id);
  if (error) {
    alert("操作失败：" + error.message);
    return;
  }
  await loadBlessings();
}

async function rejectBless(id) {
  const reason = window.prompt("请输入驳回理由（可留空）：", "");
  if (reason === null) return;
  const { error } = await supabase
    .from("bless")
    .update({ status: "rejected", reject_reason: reason })
    .eq("id", id);
  if (error) {
    alert("操作失败：" + error.message);
    return;
  }
  await loadBlessings();
}

async function deleteBless(id) {
  if (!confirm("确定删除这条祝福吗？此操作不可恢复。")) return;
  const { error } = await supabase.from("bless").delete().eq("id", id);
  if (error) {
    alert("删除失败：" + error.message);
    return;
  }
  await loadBlessings();
}

document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

const blessSection = document.getElementById("blessSection");
const videoSection = document.getElementById("videoSection");
const noticeSection = document.getElementById("noticeSection");
const compressSection = document.getElementById("compressSection");

function switchSection(section) {
  currentSection = section;
  document.getElementById("tabBless").classList.toggle("active", section === "bless");
  document.getElementById("tabVideo").classList.toggle("active", section === "video");
  document.getElementById("tabNotice").classList.toggle("active", section === "notice");
  document.getElementById("tabCompress").classList.toggle("active", section === "compress");
  blessSection.classList.toggle("hidden", section !== "bless");
  videoSection.classList.toggle("hidden", section !== "video");
  noticeSection.classList.toggle("hidden", section !== "notice");
  compressSection.classList.toggle("hidden", section !== "compress");
  if (section === "bless") {
    renderStats();
  } else if (section === "video") {
    document.getElementById("stats").textContent = `视频共 ${allVideos.length} 个`;
  } else if (section === "notice") {
    document.getElementById("stats").textContent = "编辑星海通知弹窗";
  } else {
    document.getElementById("stats").textContent = "批量压缩已上传图片";
  }
}

document.getElementById("tabBless").addEventListener("click", () => switchSection("bless"));
document.getElementById("tabVideo").addEventListener("click", async () => {
  switchSection("video");
  await loadVideos();
});
document.getElementById("tabNotice").addEventListener("click", async () => {
  switchSection("notice");
  await loadNoticeForEdit();
});
document.getElementById("tabCompress").addEventListener("click", () => switchSection("compress"));

async function batchCompress() {
  const status = document.getElementById("compressStatus");
  const btn = document.getElementById("compressStart");
  btn.disabled = true;
  btn.textContent = "压缩中…";
  status.textContent = "正在列出图片…";

  const folders = ["photos", "covers"];
  const targets = [];

  for (const folder of folders) {
    const { data, error } = await supabase.storage.from("bless-media").list(folder, { limit: 1000 });
    if (error) {
      status.textContent = `列出 ${folder} 失败：${error.message}`;
      btn.disabled = false;
      btn.textContent = "开始压缩";
      return;
    }
    for (const f of data || []) {
      if (!f.id) continue;
      if (!/\.(jpe?g|png|webp|bmp)$/i.test(f.name)) continue;
      targets.push({ folder, name: f.name });
    }
  }

  if (targets.length === 0) {
    status.textContent = "没有需要压缩的图片";
    btn.disabled = false;
    btn.textContent = "开始压缩";
    return;
  }

  let done = 0;
  let failed = 0;

  for (const t of targets) {
    const path = `${t.folder}/${t.name}`;
    try {
      const { data: blob, error: derr } = await supabase.storage.from("bless-media").download(path);
      if (derr || !blob) {
        failed++;
      } else {
        const file = new File([blob], t.name, { type: blob.type || "image/jpeg" });
        const compressed = await compressImage(file);
        if (compressed !== file) {
          const { error: uerr } = await supabase.storage.from("bless-media").upload(path, compressed, {
            cacheControl: "3600",
            upsert: true,
            contentType: compressed.type,
          });
          if (uerr) failed++;
          else done++;
        } else {
          done++;
        }
      }
    } catch {
      failed++;
    }
    status.textContent = `进度 ${done + failed}/${targets.length}（成功 ${done}，失败 ${failed}）`;
  }

  btn.disabled = false;
  btn.textContent = "开始压缩";
  status.textContent = `完成：成功 ${done}，失败 ${failed}，共 ${targets.length} 张`;
}

document.getElementById("compressStart").addEventListener("click", batchCompress);

async function loadNoticeForEdit() {
  const { data, error } = await supabase
    .from("notice")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) {
    document.getElementById("noticeContentInput").value = "";
    document.getElementById("noticeEnabled").checked = false;
    document.getElementById("aboutInput").value = "";
    document.getElementById("nikkiContentInput").value = "";
    document.getElementById("inviteContentInput").value = "";
    return;
  }
  document.getElementById("noticeContentInput").value = data.content || "";
  document.getElementById("noticeEnabled").checked = !!data.enabled;
  document.getElementById("aboutInput").value = data.about || "";
  document.getElementById("nikkiContentInput").value = data.nikki_content || "";
  document.getElementById("inviteContentInput").value = data.invite_content || "";
}

document.getElementById("noticeSave").addEventListener("click", async () => {
  const content = document.getElementById("noticeContentInput").value.trim();
  const enabled = document.getElementById("noticeEnabled").checked;
  const btn = document.getElementById("noticeSave");
  btn.disabled = true;
  btn.textContent = "保存中…";

  const { error } = await supabase.from("notice").upsert({
    id: 1,
    content,
    enabled,
    updated_at: new Date().toISOString(),
  });

  btn.disabled = false;
  btn.textContent = "保存通知";

  if (error) {
    alert("保存失败：" + error.message);
    return;
  }
  alert("已保存");
});

document.getElementById("aboutSave").addEventListener("click", async () => {
  const about = document.getElementById("aboutInput").value.trim();
  const btn = document.getElementById("aboutSave");
  btn.disabled = true;
  btn.textContent = "保存中…";

  const { error } = await supabase.from("notice").upsert({
    id: 1,
    about,
    updated_at: new Date().toISOString(),
  });

  btn.disabled = false;
  btn.textContent = "保存关于我们";

  if (error) {
    alert("保存失败：" + error.message);
    return;
  }
  alert("已保存");
});

document.getElementById("nikkiSave").addEventListener("click", async () => {
  const content = document.getElementById("nikkiContentInput").value.trim();
  const imageFile = document.getElementById("nikkiImageFile").files[0];
  const btn = document.getElementById("nikkiSave");
  btn.disabled = true;
  btn.textContent = "保存中…";

  let nikki_image_url = null;
  if (imageFile) {
    try {
      const compressed = await compressImage(imageFile);
      nikki_image_url = await uploadCover(compressed, "nikki");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "保存暖暖弹窗";
      alert("图片上传失败：" + (err.message || "请重试"));
      return;
    }
  }

  const payload = {
    id: 1,
    nikki_content: content,
    updated_at: new Date().toISOString(),
  };
  if (nikki_image_url) payload.nikki_image_url = nikki_image_url;

  const { error } = await supabase.from("notice").upsert(payload);

  btn.disabled = false;
  btn.textContent = "保存暖暖弹窗";

  if (error) {
    alert("保存失败：" + error.message);
    return;
  }
  alert("已保存");
  document.getElementById("nikkiImageFile").value = "";
});

document.getElementById("inviteSave").addEventListener("click", async () => {
  const content = document.getElementById("inviteContentInput").value.trim();
  const imageFile = document.getElementById("inviteImageFile").files[0];
  const btn = document.getElementById("inviteSave");
  btn.disabled = true;
  btn.textContent = "保存中…";

  let invite_image_url = null;
  if (imageFile) {
    try {
      const compressed = await compressImage(imageFile);
      invite_image_url = await uploadCover(compressed, "invite");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "保存邀请函";
      alert("图片上传失败：" + (err.message || "请重试"));
      return;
    }
  }

  const payload = {
    id: 1,
    invite_content: content,
    updated_at: new Date().toISOString(),
  };
  if (invite_image_url) payload.invite_image_url = invite_image_url;

  const { error } = await supabase.from("notice").upsert(payload);

  btn.disabled = false;
  btn.textContent = "保存邀请函";

  if (error) {
    alert("保存失败：" + error.message);
    return;
  }
  alert("已保存");
  document.getElementById("inviteImageFile").value = "";
});

async function loadVideos() {
  const { data, error } = await supabase
    .from("video_wall")
    .select("*")
    .order("sort_num", { ascending: true })
    .order("create_at", { ascending: true });

  if (error) {
    alert("加载视频失败：" + error.message);
    return;
  }

  allVideos = data || [];
  document.getElementById("stats").textContent = `视频共 ${allVideos.length} 个`;
  renderVideoList();
}

function renderVideoList() {
  const list = document.getElementById("videoList");
  list.innerHTML = "";

  if (allVideos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "暂无视频";
    list.appendChild(empty);
    return;
  }

  for (const v of allVideos) {
    list.appendChild(buildVideoCard(v));
  }
}

function buildVideoCard(v) {
  const card = document.createElement("div");
  card.className = "card video-card";

  const head = document.createElement("div");
  head.className = "card-head";

  const author = document.createElement("span");
  author.className = "card-nick";
  author.textContent = v.author;

  const sort = document.createElement("span");
  sort.className = "badge badge-pending";
  sort.textContent = "排序 " + (v.sort_num ?? 0);

  head.append(author, sort);

  const title = document.createElement("div");
  title.className = "card-content";
  title.textContent = v.title || "（无标题）";

  const embed = document.createElement("div");
  embed.className = "card-time";
  embed.textContent = v.embed_url;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const del = document.createElement("button");
  del.className = "btn-delete";
  del.textContent = "删除";
  del.addEventListener("click", () => deleteVideo(v.id));
  actions.appendChild(del);

  card.append(head, title, embed, actions);
  return card;
}

async function deleteVideo(id) {
  if (!confirm("确定删除这个视频吗？")) return;
  const { error } = await supabase.from("video_wall").delete().eq("id", id);
  if (error) {
    alert("删除失败：" + error.message);
    return;
  }
  allVideos = allVideos.filter((v) => v.id !== id);
  document.getElementById("stats").textContent = `视频共 ${allVideos.length} 个`;
  renderVideoList();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 200 * 1024) return file;
  const img = await loadImage(file).catch(() => null);
  if (!img) return file;
  const MAX_DIM = 1280;
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

async function uploadCover(file, folder = "covers") {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("bless-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("bless-media").getPublicUrl(path);
  return data.publicUrl;
}

document.getElementById("videoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const author = document.getElementById("vAuthor").value.trim();
  const title = document.getElementById("vTitle").value.trim();
  const embed_url = document.getElementById("vEmbed").value.trim();
  const sort_num = parseInt(document.getElementById("vSort").value, 10) || 0;
  const err = document.getElementById("videoFormError");
  err.classList.add("hidden");

  if (!author || !embed_url) {
    err.textContent = "投稿人和嵌入链接必填";
    err.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("videoSubmit");
  btn.disabled = true;
  btn.textContent = "处理中…";

  let cover_url = document.getElementById("vCover").value.trim() || null;
  const coverFile = document.getElementById("vCoverFile").files[0];
  if (coverFile) {
    try {
      const compressed = await compressImage(coverFile);
      cover_url = await uploadCover(compressed);
    } catch (err2) {
      btn.disabled = false;
      btn.textContent = "添加视频";
      err.textContent = "封面上传失败：" + (err2.message || "请重试");
      err.classList.remove("hidden");
      return;
    }
  }

  const { error } = await supabase.from("video_wall").insert({
    author,
    title: title || null,
    embed_url,
    cover_url,
    sort_num,
  });

  btn.disabled = false;
  btn.textContent = "添加视频";

  if (error) {
    err.textContent = "添加失败：" + error.message;
    err.classList.remove("hidden");
    return;
  }

  document.getElementById("videoForm").reset();
  await loadVideos();
});

async function init() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    if (!(await isAdmin())) {
      await supabase.auth.signOut();
      showLogin();
      return;
    }
    showPanel();
    await loadBlessings();
  } else {
    showLogin();
  }
}

init();
