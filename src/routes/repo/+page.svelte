<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import InfiniteScroll from "$lib/components/InfiniteScroll.svelte";

  interface RepoFile {
    name: string;
    isDir: boolean;
    message: string;
    time: string;
  }

  interface PinnedRepo {
    name: string;
    desc: string;
    lang: string;
    langColor: string;
    stars: number;
    forks: number;
    visibility: string;
  }

  const repoFiles: RepoFile[] = [
    { name: "angels/", isDir: true, message: "Add Angel data schemas and classification", time: "3 days ago" },
    { name: "eva/", isDir: true, message: "Unit-01 control system refactor", time: "2 days ago" },
    { name: "geofront/", isDir: true, message: "Update Geofront internal documentation", time: "5 days ago" },
    { name: "magi/", isDir: true, message: "MAGI system core modules", time: "1 week ago" },
    { name: "operations/", isDir: true, message: "Add Standard Operating Procedures", time: "4 days ago" },
    { name: "research/", isDir: true, message: "LCL hypothesis experiments", time: "6 days ago" },
    { name: "docs/", isDir: true, message: "Update NERV Technical Manual", time: "3 days ago" },
    { name: ".gitignore", isDir: false, message: "Initialize repository", time: "1 week ago" },
    { name: "LICENSE", isDir: false, message: "NERV Non-Disclosure Agreement", time: "1 week ago" },
    { name: "README.md", isDir: false, message: "Update README", time: "2 days ago" },
  ];

  const pinnedRepos: PinnedRepo[] = [
    { name: "eva-operational-system", desc: "Next-generation Evangelion OS and pilot interface stack.", lang: "C++", langColor: "#f34b7d", stars: 812, forks: 134, visibility: "Private" },
    { name: "magi-core", desc: "MAGI supercomputer core systems and AT Field simulations.", lang: "Rust", langColor: "#dea584", stars: 567, forks: 121, visibility: "Private" },
    { name: "lcl-monitor", desc: "LCL environment monitoring and synchronization tools.", lang: "Go", langColor: "#00ADD8", stars: 230, forks: 45, visibility: "Private" },
    { name: "s2-engine", desc: "Strategic analysis engine for Scenario Simulation System.", lang: "Python", langColor: "#3572A5", stars: 391, forks: 78, visibility: "Private" },
  ];

  const tabs = ["Code", "Issues", "Pull requests", "Actions", "Projects", "Security", "Insights"];
  let activeTab = $state("Code");

  const topics = ["eva", "angels", "human-instrumentality", "classified", "tokyo-3", "nerv"];

  const announcements = [
    { title: "CODE RED: System Maintenance", date: "2025/06/18", danger: true },
    { title: "New: Classified Repositories", date: "2025/06/10", danger: false },
    { title: "Guidelines Update", date: "2025/06/01", danger: false },
  ];

  const stats = [
    { label: "Commits", value: "1,238" },
    { label: "Branches", value: "7" },
    { label: "Contributors", value: "SEELE, NervHQ Ops" },
    { label: "Last Commit", value: "2 days ago" },
  ];
</script>

<svelte:head>
  <title>NERV GitHub — Repository</title>
</svelte:head>

<div class="repo-page">
  <!-- TOP NAV BAR -->
  <nav class="repo-nav">
    <div class="nav-left">
      <div class="nav-logo">
        <span class="ews-text danger text-lg font-bold">NERV</span>
        <span class="text-white text-sm ml-1">GitHub</span>
      </div>
      {#each ["Why NERV", "Product", "Solutions", "Open Source", "Enterprise"] as item}
        <span class="nav-link">{item}</span>
      {/each}
    </div>
    <div class="nav-right">
      <div class="nav-search bordered">
        <span class="text-xs opacity-50">Search NERV GitHub...</span>
      </div>
      <span class="nav-link">Sign in</span>
      <button class="bordered-red px-3 py-1 text-xs ews-text danger cursor-pointer">Create account</button>
    </div>
  </nav>

  <StripeBar color="red" loop={true} duration={20} size="3px"></StripeBar>

  <div class="repo-content">
    <!-- LEFT SIDEBAR (Profile) -->
    <aside class="repo-sidebar">
      <Card className="w-full mb-4">
        {#snippet title()}
          <StripeBar color="red" loop={true} duration={20}>
            <div class="ews-card-text">
              <p class="p-1 bg-black font-bold text-xs">WELCOME, USER</p>
            </div>
          </StripeBar>
        {/snippet}
        {#snippet children()}
          <div class="p-3">
            <p class="text-xs opacity-60 mb-1">AUTHORIZATION LEVEL:</p>
            <div class="flex items-center gap-2 mb-3">
              <span class="ews-text-digital danger text-4xl">03</span>
              <div>
                <p class="ews-text text-xs">内部</p>
                <p class="ews-text text-xs">INTERNAL</p>
              </div>
            </div>
            <div class="bordered-red p-2 mb-3 text-xs">
              <p class="ews-text danger text-xs">「すべてのコードは、</p>
              <p class="ews-text danger text-xs">人類補完計画の一部である。」</p>
            </div>
            <p class="text-xs opacity-40 mb-2">~ SEELE DIRECTIVE 01</p>
          </div>
        {/snippet}
      </Card>

      <Card className="w-full mb-4">
        {#snippet title()}
          <p class="p-1 text-xs">NERV SYSTEMS</p>
        {/snippet}
        {#snippet children()}
          <div class="p-2 flex flex-col gap-1">
            {#each ["Repositories", "Codespaces", "Issues", "Pull requests", "Actions", "Packages", "Security", "Insights"] as item, i}
              <div class="sidebar-nav-item" class:active={i === 0}>
                <span class="text-xs">{item}</span>
              </div>
            {/each}
          </div>
        {/snippet}
      </Card>

      <Card className="w-full">
        {#snippet title()}
          <p class="p-1 text-xs">STATUS MONITOR / ステータス監視</p>
        {/snippet}
        {#snippet children()}
          <div class="p-2 flex flex-col gap-2">
            {#each [
              { name: "MAGI Systems", status: "正常", label: "Nominal", ok: true },
              { name: "Geofront Synch", status: "正常", label: "Nominal", ok: true },
              { name: "Command Uplink", status: "接続中", label: "Connected", ok: true },
            ] as sys}
              <div class="flex justify-between items-center text-xs">
                <div>
                  <p>{sys.name}</p>
                  <p class="opacity-40 text-[10px]">{sys.status}</p>
                </div>
                <span class="ews-text text-xs">{sys.label}</span>
              </div>
            {/each}
          </div>
        {/snippet}
      </Card>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="repo-main">
      <!-- Hero Section -->
      <section class="repo-hero mb-6">
        <h1 class="text-4xl font-bold text-white mb-1">Build the future.</h1>
        <h1 class="text-4xl font-bold text-white mb-3">For the sake of humanity.</h1>
        <p class="text-sm opacity-60 mb-1">人類のために、未来を構築する。</p>
        <p class="text-sm text-gray-400 mb-4 max-w-md">
          NERV GitHub is the secure development platform trusted by NERV personnel worldwide to build, collaborate, and deploy critical systems.
        </p>
        <div class="flex gap-3 items-center mb-4">
          <button class="bordered-red px-4 py-2 text-xs ews-text danger cursor-pointer font-bold">Create account</button>
          <span class="nav-link text-sm cursor-pointer">Contact Central Dogma ›</span>
        </div>
        <p class="ews-text danger text-xs opacity-70 italic">GOD'S IN HIS HEAVEN. ALL'S RIGHT WITH THE WORLD.</p>
        <p class="text-[10px] opacity-40">神は天にいまし、すべて世は事もなし。</p>
      </section>

      <!-- Tab Bar -->
      <div class="repo-tabs bordered-red mb-4">
        <StripeBar color="red" loop={true} duration={20} size="2px"></StripeBar>
        <div class="flex gap-0">
          {#each tabs as tab}
            <button
              class="tab-item cursor-pointer"
              class:active={activeTab === tab}
              onclick={() => activeTab = tab}
            >
              {tab}
            </button>
          {/each}
        </div>
        <StripeBar color="red" loop={true} reverse={true} duration={20} size="2px"></StripeBar>
      </div>

      <!-- REPO Header -->
      <div class="flex items-center gap-2 mb-4">
        <span class="ews-text danger text-sm font-bold">nerv-hq</span>
        <span class="bordered-red px-2 py-0 text-[10px]">Private</span>
      </div>

      <div class="flex gap-4 text-xs mb-4 opacity-60">
        <span>GOD'S IN HIS HEAVEN. ALL'S RIGHT WITH THE WORLD.</span>
      </div>

      <div class="flex gap-3 text-xs mb-4">
        <span class="bordered px-2 py-1">🔒 Restricted</span>
        <span class="opacity-60">📍 Tokyo-3, Japan</span>
        <a href="#" class="ews-text-underline text-xs">https://www.nerv.jp</a>
      </div>

      <!-- Topics -->
      <div class="flex gap-2 mb-4 flex-wrap">
        {#each topics as topic}
          <span class="repo-topic">{topic}</span>
        {/each}
      </div>

      <!-- Repo Controls -->
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <div class="bordered px-3 py-1 text-xs flex items-center gap-1">
          <span>⎇</span> main ▾
        </div>
        <span class="text-xs opacity-60">⎇ 7 Branches</span>
        <span class="text-xs opacity-60">🏷 0 Tags</span>
        <div class="ml-auto flex gap-2">
          <button class="bordered px-3 py-1 text-xs cursor-pointer">Go to file</button>
          <button class="bordered px-3 py-1 text-xs cursor-pointer">Add file ▾</button>
          <button class="bordered-red px-3 py-1 text-xs ews-text danger cursor-pointer font-bold">&lt;&gt; Code ▾</button>
        </div>
      </div>

      <!-- Commit info -->
      <div class="bordered p-2 mb-1 flex items-center gap-3 text-xs">
        <span class="font-bold">SEELE</span>
        <span class="opacity-60">Committer</span>
        <span class="opacity-40 ml-auto">Initial commit: Establish NERV repository infrastructure</span>
        <span class="opacity-40">2 days ago</span>
        <span class="bordered px-1 text-[10px]">SEELE-0001</span>
      </div>

      <!-- File List -->
      <div class="file-list bordered mb-6">
        {#each repoFiles as file}
          <div class="file-row">
            <span class="file-icon">{file.isDir ? "📁" : "📄"}</span>
            <span class="file-name" class:is-dir={file.isDir}>{file.name}</span>
            <span class="file-message">{file.message}</span>
            <span class="file-time">{file.time}</span>
          </div>
        {/each}
      </div>

      <!-- README -->
      <Card className="w-full mb-6">
        {#snippet title()}
          <StripeBar loop={true} duration={20}>
            <div class="ews-card-text">
              <p class="p-1 bg-black font-bold text-xs">📄 README.md</p>
            </div>
          </StripeBar>
        {/snippet}
        {#snippet children()}
          <div class="p-4">
            <h2 class="text-2xl font-bold text-white mb-1">NERV Headquarters Repository</h2>
            <p class="ews-text danger text-sm mb-3">ネルフ本部リポジトリ</p>
            <p class="text-sm text-gray-300 mb-2">このリポジトリは、NERVの活動に関する機密情報および技術資産を管理することを目的としています。</p>
            <p class="text-sm text-gray-400 mb-4">This repository contains confidential and classified information related to NERV operations and research.</p>
            <div class="bordered-red p-3">
              <p class="ews-text danger text-xs ews-text-blink">⚠ 機密情報：関係者以外のアクセスを固く禁じます。</p>
              <p class="ews-text danger text-xs">CONFIDENTIAL: Unauthorized access is strictly prohibited.</p>
            </div>
          </div>
        {/snippet}
      </Card>

      <!-- Pinned Repos -->
      <div class="flex justify-between items-center mb-3">
        <div>
          <h2 class="ews-text text-lg">Pinned repositories</h2>
          <p class="text-xs opacity-40">ピン留めされたリポジトリ</p>
        </div>
        <a href="#" class="ews-text text-xs">View all repositories →</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {#each pinnedRepos as repo}
          <div class="bordered p-3 hover:border-orange-400 transition-all cursor-pointer">
            <div class="flex items-center gap-2 mb-2">
              <span class="ews-text text-sm font-bold">{repo.name}</span>
              <span class="bordered-red px-1 text-[10px] opacity-60">{repo.visibility}</span>
            </div>
            <p class="text-xs text-gray-400 mb-3">{repo.desc}</p>
            <div class="flex items-center gap-4 text-xs opacity-60">
              <span class="flex items-center gap-1">
                <span class="inline-block w-2 h-2 rounded-full" style="background:{repo.langColor}"></span>
                {repo.lang}
              </span>
              <span>☆ {repo.stars}</span>
              <span>🍴 {repo.forks}</span>
            </div>
          </div>
        {/each}
      </div>
    </main>

    <!-- RIGHT SIDEBAR -->
    <aside class="repo-right-sidebar">
      <!-- About -->
      <Card className="w-full mb-4">
        {#snippet title()}
          <p class="p-1 text-xs">About</p>
        {/snippet}
        {#snippet children()}
          <div class="p-3 text-xs">
            <p class="text-gray-300 mb-1">Official NERV repository.</p>
            <p class="text-gray-300 mb-3">For the protection of humanity.</p>
            <div class="flex gap-1 flex-wrap mb-3">
              {#each topics as t}
                <span class="repo-topic text-[10px]">{t}</span>
              {/each}
            </div>
            <div class="flex flex-col gap-1 opacity-60">
              <span>📖 Readme</span>
              <span>📜 NERV Non-Disclosure Agreement</span>
              <span>⚡ Activity</span>
              <span>⚙ Custom properties</span>
            </div>
          </div>
        {/snippet}
      </Card>

      <!-- Announcements -->
      <Card className="w-full mb-4">
        {#snippet title()}
          <StripeBar color="red" loop={true} duration={20}>
            <div class="ews-card-text">
              <p class="p-1 bg-black font-bold text-xs">NERV Announcements</p>
            </div>
          </StripeBar>
        {/snippet}
        {#snippet children()}
          <div class="p-3 flex flex-col gap-3">
            {#each announcements as ann}
              <div class="flex justify-between items-start">
                <span class="text-xs" class:ews-text={ann.danger} class:danger={ann.danger}>{ann.title}</span>
                <span class="text-[10px] opacity-40 whitespace-nowrap ml-2">{ann.date}</span>
              </div>
            {/each}
          </div>
        {/snippet}
      </Card>

      <!-- Stats -->
      <Card className="w-full mb-4">
        {#snippet title()}
          <p class="p-1 text-xs">Repository Stats</p>
        {/snippet}
        {#snippet children()}
          <div class="p-3 flex flex-col gap-2">
            {#each stats as s}
              <div class="flex justify-between text-xs">
                <span class="opacity-60">{s.label}</span>
                <span class="text-white">{s.value}</span>
              </div>
            {/each}
          </div>
        {/snippet}
      </Card>

      <!-- Security -->
      <Card className="w-full">
        {#snippet title()}
          <p class="p-1 text-xs">Security</p>
        {/snippet}
        {#snippet children()}
          <div class="p-3 flex items-center gap-2 text-xs">
            <span class="ews-text danger">🔒</span>
            <span class="text-gray-400">This repository is private and access is restricted.</span>
          </div>
        {/snippet}
      </Card>
    </aside>
  </div>

  <!-- FOOTER -->
  <StripeBar color="red" loop={true} reverse={true} duration={20} size="3px"></StripeBar>
  <footer class="repo-footer">
    <div class="flex items-center justify-between flex-wrap gap-4 p-4">
      <div>
        <p class="ews-text danger text-sm italic">「成果を求めるな。使命を全うせよ。」</p>
        <p class="text-xs text-gray-400">"Do not seek results. Fulfill your mission."</p>
        <p class="text-[10px] opacity-40 mt-1">~ GENDŌ IKARI, NERV COMMANDER</p>
      </div>
      <div class="text-right">
        <p class="text-xs opacity-40">ALL PROJECTS, DATA, AND COMMUNICATIONS</p>
        <p class="text-xs opacity-40">ARE THE PROPERTY OF NERV.</p>
        <p class="text-[10px] opacity-30 mt-1">© NERV GitHub 2015-2025</p>
      </div>
    </div>
  </footer>

  <!-- Scrolling ticker -->
  <div class="repo-ticker">
    <InfiniteScroll speed={40} gap={48}>
      {#snippet children()}
        <span class="ews-text danger text-xs px-4">⚠ CLASSIFIED</span>
        <span class="ews-text text-xs px-4">NERV SECURE DEVELOPMENT PLATFORM</span>
        <span class="ews-text danger text-xs px-4">⚠ LEVEL 3 ACCESS</span>
        <span class="ews-text text-xs px-4">SEELE APPROVED</span>
      {/snippet}
    </InfiniteScroll>
  </div>
</div>

<style>
  .repo-page {
    min-height: 100vh;
    background: black;
    font-family: "Roboto Condensed", Arial, Helvetica, sans-serif;
  }

  /* NAV */
  .repo-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(0,0,0,0.95);
    border-bottom: 1px solid rgba(255,0,0,0.2);
  }
  .nav-left, .nav-right { display: flex; align-items: center; gap: 16px; }
  .nav-logo { display: flex; align-items: baseline; gap: 2px; }
  .nav-link { font-size: 12px; color: rgba(255,255,255,0.6); cursor: pointer; transition: color 0.2s; }
  .nav-link:hover { color: var(--orange); }
  .nav-search { padding: 4px 12px; min-width: 180px; }

  /* LAYOUT */
  .repo-content {
    display: grid;
    grid-template-columns: 220px 1fr 240px;
    gap: 16px;
    padding: 16px;
    max-width: 1400px;
    margin: 0 auto;
  }

  @media (max-width: 1024px) {
    .repo-content { grid-template-columns: 1fr; }
    .repo-sidebar, .repo-right-sidebar { display: none; }
  }

  /* SIDEBAR */
  .repo-sidebar, .repo-right-sidebar { font-size: 12px; }

  .sidebar-nav-item {
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.2s;
    border-left: 2px solid transparent;
  }
  .sidebar-nav-item:hover { background: rgba(255,170,0,0.05); border-left-color: var(--orange); }
  .sidebar-nav-item.active { background: rgba(255,170,0,0.1); border-left-color: var(--orange); }

  /* TABS */
  .tab-item {
    padding: 8px 16px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.5);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    font-family: "Roboto Condensed", Arial, sans-serif;
  }
  .tab-item:hover { color: var(--orange); }
  .tab-item.active { color: var(--orange); border-bottom-color: var(--orange); }

  /* FILE LIST */
  .file-list { border-radius: var(--gutter-size); overflow: hidden; }
  .file-row {
    display: grid;
    grid-template-columns: 24px 160px 1fr auto;
    gap: 8px;
    padding: 6px 12px;
    align-items: center;
    border-bottom: 1px solid rgba(255,170,0,0.1);
    font-size: 12px;
    transition: background 0.15s;
  }
  .file-row:hover { background: rgba(255,170,0,0.03); }
  .file-row:last-child { border-bottom: none; }
  .file-icon { font-size: 14px; }
  .file-name { color: var(--orange); cursor: pointer; }
  .file-name:hover { text-decoration: underline; }
  .file-name.is-dir { font-weight: bold; }
  .file-message { color: rgba(255,255,255,0.4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-time { color: rgba(255,255,255,0.3); white-space: nowrap; }

  /* TOPICS */
  .repo-topic {
    background: rgba(230,9,8,0.15);
    color: var(--red);
    border: 1px solid rgba(230,9,8,0.3);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .repo-topic:hover { background: rgba(230,9,8,0.25); }

  /* FOOTER */
  .repo-footer { background: rgba(10,0,0,0.8); border-top: 1px solid rgba(255,0,0,0.15); }

  /* TICKER */
  .repo-ticker {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.9);
    border-top: 1px solid rgba(255,170,0,0.2);
    padding: 4px 0;
    z-index: 50;
  }

  .repo-hero { padding-top: 8px; }
</style>
