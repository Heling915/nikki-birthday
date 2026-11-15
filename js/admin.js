import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUS_TEXT = { pending: "待审核", passed: "已通过", rejected: "已驳回" };

let currentFilter = "pending";
let allBlessings = [];
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
    err.textContent = "登录失败：" + (error.message || "请检查邮箱密码");
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
  allBlessings = [];
  showLogin();
});

async function loadBlessings() {
  const { data, error } = await supabase
    .from("bless")
    .select("*")
    .order("create_at", { ascending: false });

  if (error) {
    alert("加载失败：" + error.message);
    return;
  }

  allBlessings = data || [];
  renderStats();
  renderList();
}

function renderStats() {
  const pending = allBlessings.filter((b) => b.status === "pending").length;
  const passed = allBlessings.filter((b) => b.status === "passed").length;
  const rejected = allBlessings.filter((b) => b.status === "rejected").length;
  document.getElementById("stats").textContent =
    `待审核 ${pending} · 已通过 ${passed} · 已驳回 ${rejected} · 共 ${allBlessings.length}`;
}

function renderList() {
  const list = document.getElementById("list");
  const items =
    currentFilter === "all"
      ? allBlessings
      : allBlessings.filter((b) => b.status === currentFilter);

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
    const audio = document.createElement("audio");
    audio.className = "card-audio";
    audio.controls = true;
    audio.src = b.audio_url;
    card.appendChild(audio);
  }

  const time = document.createElement("div");
  time.className = "card-time";
  time.textContent = b.create_at ? new Date(b.create_at).toLocaleString("zh-CN") : "";
  card.appendChild(time);

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
    reject.addEventListener("click", () => setStatus(b.id, "rejected"));
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
  const item = allBlessings.find((b) => b.id === id);
  if (item) item.status = status;
  renderStats();
  renderList();
}

async function deleteBless(id) {
  if (!confirm("确定删除这条祝福吗？此操作不可恢复。")) return;
  const { error } = await supabase.from("bless").delete().eq("id", id);
  if (error) {
    alert("删除失败：" + error.message);
    return;
  }
  allBlessings = allBlessings.filter((b) => b.id !== id);
  renderStats();
  renderList();
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

function switchSection(section) {
  currentSection = section;
  document.getElementById("tabBless").classList.toggle("active", section === "bless");
  document.getElementById("tabVideo").classList.toggle("active", section === "video");
  blessSection.classList.toggle("hidden", section !== "bless");
  videoSection.classList.toggle("hidden", section !== "video");
  if (section === "bless") {
    renderStats();
  } else {
    document.getElementById("stats").textContent = `视频共 ${allVideos.length} 个`;
  }
}

document.getElementById("tabBless").addEventListener("click", () => switchSection("bless"));
document.getElementById("tabVideo").addEventListener("click", async () => {
  switchSection("video");
  await loadVideos();
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

document.getElementById("videoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const author = document.getElementById("vAuthor").value.trim();
  const title = document.getElementById("vTitle").value.trim();
  const embed_url = document.getElementById("vEmbed").value.trim();
  const cover_url = document.getElementById("vCover").value.trim();
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
  btn.textContent = "添加中…";

  const { error } = await supabase.from("video_wall").insert({
    author,
    title: title || null,
    embed_url,
    cover_url: cover_url || null,
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
    showPanel();
    await loadBlessings();
  } else {
    showLogin();
  }
}

init();
