// Illustrative assets for the library samples, drawn inline so the catalog needs no files. Each one says
// it is a sample on its face: these stand in for real captures, thumbnails and logos, which a
// real reel always takes from the source (see docs/STYLE.md).

const svg = (w: number, h: number, body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
const font = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`;
const bar = (x: number, y: number, w: number, h = 16, fill = "#DADDE2") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>`;

// A plain page standing in for a capture: a heading, a highlighted line, paragraphs as bars.
export const SAMPLE_PAGE_SIZE: [number, number] = [1600, 1000];
export const samplePage = () =>
  svg(
    1600,
    1000,
    `<rect width="1600" height="1000" fill="#FFFFFF"/>
     <rect x="0" y="0" width="1600" height="88" fill="#F5F6F8"/>
     ${bar(64, 36, 180, 16, "#C6CBD2")}${bar(1300, 36, 236, 16, "#DADDE2")}
     <text x="120" y="230" ${font} font-weight="700" font-size="76" fill="#0E1013">Sample page</text>
     <text x="120" y="300" ${font} font-size="34" fill="#6E737B">Illustration of a capture. A real reel shows the source itself.</text>
     ${[0, 1, 2, 3].map((i) => bar(120, 380 + i * 44, [1180, 1240, 1100, 760][i])).join("")}
     <text x="120" y="610" ${font} font-weight="700" font-size="44" fill="#0E1013">The line being discussed</text>
     ${[0, 1, 2, 3, 4].map((i) => bar(120, 670 + i * 44, [1260, 1200, 1320, 1080, 640][i])).join("")}`,
  );

// A neutral monogram standing in for an official logo. Never a real mark.
export const sampleLogo = (letter: string, i = 0) =>
  svg(
    200,
    200,
    `<rect x="10" y="10" width="180" height="180" rx="44" fill="${["#0E1013", "#2563EB", "#6E737B", "#C6CBD2"][i % 4]}"/>
     <text x="100" y="128" text-anchor="middle" ${font} font-weight="700" font-size="84" fill="${i % 4 === 3 ? "#0E1013" : "#FFFFFF"}">${letter}</text>`,
  );

// A 16:9 thumbnail standing in for a real one, numbered.
export const sampleThumb = (n: number) =>
  svg(
    640,
    360,
    `<rect width="640" height="360" fill="${n % 2 ? "#E2E5EA" : "#D3D7DD"}"/>
     <rect x="40" y="40" width="${200 + (n % 3) * 60}" height="22" rx="11" fill="#FFFFFF"/>
     ${bar(40, 82, 300, 14, "#FFFFFF")}${bar(40, 108, 220, 14, "#FFFFFF")}
     <text x="600" y="320" text-anchor="end" ${font} font-weight="700" font-size="40" fill="#6E737B">Sample ${n}</text>`,
  );

// An article page: a headline, a byline, paragraphs, one quotable line. Labelled as a sample.
export const sampleArticle = () =>
  svg(
    1600,
    2000,
    `<rect width="1600" height="2000" fill="#FFFFFF"/>
     ${bar(300, 60, 160, 18, "#C6CBD2")}${bar(1120, 60, 180, 14, "#DADDE2")}
     <text x="300" y="300" ${font} font-size="30" fill="#6E737B">SAMPLE ARTICLE · ILLUSTRATION</text>
     <text x="300" y="400" ${font} font-weight="700" font-size="74" fill="#0E1013">A sample headline about</text>
     <text x="300" y="490" ${font} font-weight="700" font-size="74" fill="#0E1013">the thing being discussed</text>
     <text x="300" y="570" ${font} font-size="30" fill="#6E737B">By a sample author · 6 min read</text>
     ${[0, 1, 2, 3, 4].map((i) => bar(300, 660 + i * 50, [1000, 960, 1000, 900, 620][i], 18)).join("")}
     <text x="300" y="990" ${font} font-size="40" fill="#0E1013">The one line the reel quotes sits here.</text>
     ${[0, 1, 2, 3, 4, 5, 6].map((i) => bar(300, 1060 + i * 50, [1000, 980, 940, 1000, 860, 1000, 540][i], 18)).join("")}`,
  );
export const SAMPLE_ARTICLE_SIZE: [number, number] = [1600, 2000];

// A code repository page, generic and unbranded: owner / name, a description, a file list, a
// README heading. Labelled as a sample; a real reel captures the repository itself.
export const sampleRepo = () =>
  svg(
    1600,
    2000,
    `<rect width="1600" height="2000" fill="#FFFFFF"/>
     <rect width="1600" height="110" fill="#F5F6F8"/>
     ${bar(60, 46, 150, 18, "#C6CBD2")}
     <text x="120" y="230" ${font} font-size="44" fill="#6E737B">sample-owner /</text>
     <text x="440" y="230" ${font} font-weight="700" font-size="44" fill="#2563EB">sample-repo</text>
     <text x="120" y="300" ${font} font-size="32" fill="#0E1013">Sample repository page, an illustration. A real reel captures the repo.</text>
     <rect x="120" y="360" width="1360" height="470" rx="14" fill="none" stroke="#DADDE2" stroke-width="2"/>
     ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="120" y="${360 + i * 78}" width="1360" height="78" fill="none" stroke="#EDEFF2" stroke-width="1"/>${bar(160, 390 + i * 78, [140, 200, 120, 260, 180, 150][i], 18)}${bar(1260, 390 + i * 78, 180, 18, "#ECEEF1")}`).join("")}
     <text x="120" y="960" ${font} font-weight="700" font-size="58" fill="#0E1013">README</text>
     <text x="120" y="1050" ${font} font-size="36" fill="#0E1013">What the project does, in one sentence.</text>
     ${[0, 1, 2, 3].map((i) => bar(120, 1110 + i * 50, [1200, 1140, 1260, 700][i], 18)).join("")}
     <rect x="120" y="1340" width="1360" height="150" rx="12" fill="#F5F6F8"/>
     ${bar(160, 1395, 520, 20, "#C6CBD2")}`,
  );
export const SAMPLE_REPO_SIZE: [number, number] = [1600, 2000];

// A sign-up form, generic and unbranded: two fields, a box to tick and a button, for an agent filling
// it in. Labelled as a sample; a real reel captures the real page (its fields come with it). The
// field geometry is exported so the sample card's actions land on it.
export const SAMPLE_FORM_SIZE: [number, number] = [1600, 1000];
const field = (y: number, hint: string, ring = false) =>
  `${ring ? `<rect x="114" y="${y - 6}" width="892" height="96" rx="17" fill="none" stroke="#2563EB" stroke-opacity="0.35" stroke-width="5"/>` : ""}
   <rect x="120" y="${y}" width="880" height="84" rx="12" fill="#FFFFFF" stroke="${ring ? "#2563EB" : "#C6CBD2"}" stroke-width="2"/>
   <text x="150" y="${y + 53}" ${font} font-size="32" fill="#9AA0A8">${hint}</text>`;
export const sampleForm = () =>
  svg(
    1600,
    1000,
    `<rect width="1600" height="1000" fill="#FFFFFF"/>
     <rect width="1600" height="88" fill="#F5F6F8"/>
     ${bar(64, 36, 180, 16, "#C6CBD2")}${bar(1300, 36, 236, 16, "#DADDE2")}
     <text x="120" y="200" ${font} font-weight="700" font-size="60" fill="#0E1013">Sample form</text>
     <text x="120" y="252" ${font} font-size="28" fill="#6E737B">Illustration of a capture. A real reel fills in the real page.</text>
     <text x="120" y="338" ${font} font-weight="700" font-size="28" fill="#0E1013">Name</text>
     ${field(360, "Your name")}
     <text x="120" y="488" ${font} font-weight="700" font-size="28" fill="#0E1013">Email</text>
     ${field(510, "you@example.com")}
     <rect x="121" y="651" width="38" height="38" rx="8" fill="#FFFFFF" stroke="#C6CBD2" stroke-width="2"/>
     <text x="180" y="681" ${font} font-size="32" fill="#0E1013">Send me updates</text>
     <rect x="120" y="740" width="300" height="88" rx="14" fill="#0E1013"/>
     <text x="270" y="795" text-anchor="middle" ${font} font-weight="700" font-size="32" fill="#FFFFFF">Create account</text>`,
  );
// The sample's own looks for a field with focus and a ticked box, as a capture saves a real page's.
export const sampleFocus = (hint: string) => svg(892, 96, field(6, hint, true).replace(/x="114" y="0"/, 'x="0" y="0"').replace(/x="120"/g, 'x="6"').replace(/x="150"/g, 'x="36"'));
export const sampleTick = () =>
  svg(40, 40, `<rect x="1" y="1" width="38" height="38" rx="8" fill="#0E1013"/><path d="M11 20.5l6 6 12-13" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
