import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const grid = document.getElementById("videoGrid");
const loading = document.getElementById("loading");
const empty = document.getElementById("empty");
const modal = document.getElementById("videoModal");
const frame = document.getElementById("videoFrame");
const modalTitle = document.getElementById("videoModalTitle");
const modalAuthor = document.getElementById("videoModalAuthor");

function buildCard(v, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.animationDelay = `${Math.min(index, 12) * 55}ms`;

  const coverWrap = document.createElement("div");
  coverWrap.className = "card-cover";

  if (v.cover_url) {
    const img = document.createElement("img");
    img.className = "card-img";
    img.loading = "lazy";
    img.alt = v.title || "视频";
    img.src = v.cover_url;
    coverWrap.appendChild(img);
  } else {
    coverWrap.classList.add("no-cover");
  }

  const play = document.createElement("div");
  play.className = "card-play";
  coverWrap.appendChild(play);

  const info = document.createElement("div");
  info.className = "card-info";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = v.title || "未命名视频";

  const author = document.createElement("div");
  author.className = "card-author";
  author.textContent = v.author ? "— " + v.author : "";

  info.append(title, author);
  card.append(coverWrap, info);

  card.addEventListener("click", () => openModal(v));
  return card;
}

function openModal(v) {
  frame.src = v.embed_url;
  modalTitle.textContent = v.title || "";
  modalAuthor.textContent = v.author ? "— " + v.author : "";
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.add("hidden");
  frame.src = "";
  document.body.style.overflow = "";
}

document.getElementById("closeVideo").addEventListener("click", closeModal);
document.getElementById("videoModalBackdrop").addEventListener("click", closeModal);

async function loadVideos() {
  try {
    const { data, error } = await supabase
      .from("video_wall")
      .select("*")
      .order("sort_num", { ascending: true })
      .order("create_at", { ascending: true });

    loading.classList.add("hidden");

    if (error) {
      console.error("加载视频失败:", error);
      empty.textContent = "视频加载失败，请稍后重试";
      empty.classList.remove("hidden");
      return;
    }

    if (!data || data.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    data.forEach((v, i) => grid.appendChild(buildCard(v, i)));
  } catch (err) {
    console.error("加载视频失败:", err);
    loading.classList.add("hidden");
    empty.textContent = "视频加载失败，请稍后重试";
    empty.classList.remove("hidden");
  }
}

loadVideos();
