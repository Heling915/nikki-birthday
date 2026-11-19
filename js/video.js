import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const listEl = document.getElementById("videoList");
const frame = document.getElementById("videoFrame");
const playerTitle = document.getElementById("playerTitle");
const playerAuthor = document.getElementById("playerAuthor");
const loading = document.getElementById("loading");
const empty = document.getElementById("empty");
const container = document.getElementById("container");
const toggleBtn = document.getElementById("toggleList");

let videos = [];

function withHighQuality(url) {
  if (url.indexOf("high_quality=") !== -1) return url;
  return url + (url.indexOf("?") !== -1 ? "&" : "?") + "high_quality=1";
}

function buildListItem(v) {
  const item = document.createElement("div");
  item.className = "list-item";
  item.dataset.id = v.id;

  if (v.cover_url) {
    const img = document.createElement("img");
    img.className = "list-thumb";
    img.loading = "lazy";
    img.alt = v.title || "视频";
    img.src = v.cover_url;
    item.appendChild(img);
  } else {
    const thumb = document.createElement("div");
    thumb.className = "list-thumb";
    item.appendChild(thumb);
  }

  const info = document.createElement("div");
  info.className = "list-info";

  const title = document.createElement("div");
  title.className = "list-title";
  title.textContent = v.title || "未命名视频";

  const author = document.createElement("div");
  author.className = "list-author";
  author.textContent = v.author || "";

  info.append(title, author);
  item.append(info);

  item.addEventListener("click", () => playVideo(v));
  return item;
}

function playVideo(v) {
  frame.src = withHighQuality(v.embed_url);
  playerTitle.textContent = v.title || "";
  playerAuthor.textContent = v.author ? "— " + v.author : "";

  document.querySelectorAll(".list-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id == v.id);
  });
}

function renderList() {
  listEl.innerHTML = "";
  videos.forEach((v) => listEl.appendChild(buildListItem(v)));
}

async function loadVideos() {
  try {
    const { data, error } = await supabase
      .from("video_wall")
      .select("*")
      .order("sort_num", { ascending: true })
      .order("create_at", { ascending: true });

    loading.classList.add("hidden");

    if (error) {
      container.classList.add("hidden");
      empty.textContent = "视频加载失败，请稍后重试";
      empty.classList.remove("hidden");
      return;
    }

    if (!data || data.length === 0) {
      container.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }

    videos = data;
    renderList();
    playVideo(videos[0]);
  } catch (err) {
    console.error("加载视频失败:", err);
    loading.classList.add("hidden");
    container.classList.add("hidden");
    empty.textContent = "视频加载失败，请稍后重试";
    empty.classList.remove("hidden");
  }
}

toggleBtn.addEventListener("click", () => {
  const hidden = container.classList.toggle("sidebar-hidden");
  toggleBtn.textContent = hidden ? "展开列表" : "收起列表";
});

loadVideos();
