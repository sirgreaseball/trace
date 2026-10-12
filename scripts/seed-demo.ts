// Generates supabase/migrations/0002_demo.sql: fictional demo users and the
// public.reset_demo() function that rebuilds five demo team workspaces.
// Timestamps are written relative to now(), so the demo always looks current.
// Run: node scripts/seed-demo.ts
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { health, linkCommits } from "../src/lib/trace.ts";
import type { Commit, Decision, Dispute, Link, Member, Story, Task } from "../src/lib/types.ts";

const uuid = (seed: string) => {
  const h = createHash("sha1").update(`trace-demo:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (s: string | null) => (s === null ? "null" : `'${s.replaceAll("'", "''")}'`);
const ago = (min: number) => `now() - interval '${Math.max(0, Math.round(min))} minutes'`;
const DAY = 1440;

function rng(seed: string) {
  let a = parseInt(createHash("sha1").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- People (all fictional) ---------------------------------------------------

type Person = { key: string; name: string; github: string; hue: number };
const P = (key: string, name: string, github: string, hue: number): Person => ({ key, name, github, hue });
const people: Person[] = [
  P("isha", "Isha Kulkarni", "isha-kulkarni", 18),
  P("aarav", "Aarav Mehta", "aaravmehta", 210),
  P("kabir", "Kabir Rao", "kabir-rao", 150),
  P("meera", "Meera Iyer", "meera-iyer", 320),
  P("nair", "Prof. Meenakshi Nair", "mnair-faculty", 45),
  P("rohan", "Rohan Desai", "rohandesai", 200),
  P("tanvi", "Tanvi Shah", "tanvi-shah", 340),
  P("aditya", "Aditya Joshi", "adityaj", 100),
  P("sneha", "Sneha Patil", "sneha-patil", 280),
  P("vikram", "Vikram Singh", "vikram-singh", 25),
  P("ananya", "Ananya Bose", "ananyabose", 300),
  P("farhan", "Farhan Sheikh", "farhan-sk", 170),
  P("priya", "Priya Menon", "priya-menon", 60),
  P("neha", "Neha Gupta", "nehagupta", 230),
  P("arjun", "Arjun Reddy", "arjun-reddy", 130),
  P("zoya", "Zoya Khan", "zoya-khan", 350),
  P("siddharth", "Siddharth Jain", "sid-jain", 80),
  P("riya", "Riya Kapoor", "riya-kapoor", 5),
  P("karan", "Karan Malhotra", "karanm", 190),
  P("ishaan", "Ishaan Verma", "ishaan-verma", 260),
  P("pooja", "Pooja Bhat", "pooja-bhat", 40),
];
const person = new Map(people.map((p) => [p.key, p]));
const uid = (k: string) => uuid(`user:${k}`);
const email = (p: Person) =>
  `${p.key === "nair" ? "meenakshi.nair" : p.name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/ +/g, ".")}@example.com`;

// --- Team content ---------------------------------------------------------------

type CommitSpec = { msg: string; who: string; files: string[]; add: number; del: number; day: number };
type TaskSpec = { title: string; status: Task["status"]; who: string; commits: CommitSpec[] };
type StorySpec = {
  title: string;
  narrative: string;
  acceptance: string[];
  priority: Story["priority"];
  by: string;
  day: number;
  tasks: TaskSpec[];
};
type DecisionSpec = {
  title: string;
  rationale: string;
  alternatives: string;
  by: string;
  day: number;
  story?: number; // index into stories
  fromMessage?: number; // index into messages
  supersedes?: number; // index into decisions
};
type MessageSpec = { who: string; body: string; day: number; story?: number };
type DisputeSpec = { on: "commit" | "task"; match: string; subject: string; by: string; note: string; day: number; resolution?: string };
type Team = {
  key: string;
  name: string;
  course: string;
  owner: string;
  members: string[];
  stories: StorySpec[];
  extra: CommitSpec[];
  decisions: DecisionSpec[];
  messages: MessageSpec[];
  disputes: DisputeSpec[];
};

const C = (msg: string, who: string, files: string[], add: number, del: number, day: number): CommitSpec => ({ msg, who, files, add, del, day });

const lostAndFound: Team = {
  key: "LF",
  name: "Campus Lost & Found",
  course: "SE Lab, Sem V",
  owner: "aarav",
  members: ["isha", "kabir", "meera"],
  stories: [
    {
      title: "Sign in with college email",
      narrative: "As a student, I want to sign in with my college email, so that only people from campus can post or claim items.",
      acceptance: [
        "Given an address ending in @nmims.edu.in, when I request a sign-in link, then it arrives within a minute.",
        "Given any other address, when I try to sign in, then I see “Use your college email”.",
        "Given I'm signed in, when I close the tab and come back, then I'm still signed in.",
      ],
      priority: "must",
      by: "aarav",
      day: 33,
      tasks: [
        {
          title: "Email sign-in with domain check",
          status: "done",
          who: "aarav",
          commits: [
            C("{T}: supabase auth with magic link", "aarav", ["src/auth/signin.tsx", "src/auth/client.ts"], 182, 12, 31),
            C("{T}: reject non-college email domains", "aarav", ["src/auth/domain.ts", "tests/auth.test.ts"], 64, 3, 30),
          ],
        },
        {
          title: "Session persistence and sign-out",
          status: "done",
          who: "aarav",
          commits: [
            C("{T}: keep session across reloads", "aarav", ["src/auth/session.ts"], 52, 8, 29),
            C("{T}: sign-out button in header", "aarav", ["src/ui/Header.tsx"], 21, 2, 29),
          ],
        },
      ],
    },
    {
      title: "Report a lost item",
      narrative: "As a student who lost something, I want to report it with a photo and where I last saw it, so that a finder can recognise it.",
      acceptance: [
        "Given I'm signed in, when I submit a title, category, place and photo, then the item shows under Lost within 5 seconds.",
        "Given a photo over 5 MB, when I upload it, then it is compressed before saving.",
        "Given a missing place, when I submit, then I see which field is missing.",
      ],
      priority: "must",
      by: "isha",
      day: 33,
      tasks: [
        {
          title: "Items table and access policies",
          status: "done",
          who: "aarav",
          commits: [C("{T}: items table with row level security", "aarav", ["db/migrations/002_items.sql"], 95, 0, 30)],
        },
        {
          title: "Report form with validation",
          status: "done",
          who: "isha",
          commits: [
            C("{T}: lost item report form", "isha", ["src/items/ReportForm.tsx", "src/ui/Field.tsx"], 241, 10, 27),
            C("{T}: inline validation messages", "isha", ["src/items/ReportForm.tsx"], 66, 21, 26),
          ],
        },
        {
          title: "Photo upload with compression",
          status: "done",
          who: "meera",
          commits: [
            C("{T}: photo upload to storage bucket", "meera", ["src/items/upload.ts", "db/migrations/004_storage.sql"], 131, 4, 25),
            C("compress photos to webp before upload", "meera", ["src/items/compress.ts"], 88, 0, 24),
          ],
        },
      ],
    },
    {
      title: "Report a found item",
      narrative: "As a student who found something, I want to post it with where I left it, so that the owner knows where to collect it.",
      acceptance: [
        "Given I found an item, when I post it with a drop-off point, then it shows under Found with that point.",
        "Given I choose “Keep with me”, when I post, then my contact stays hidden until a claim is approved.",
      ],
      priority: "must",
      by: "isha",
      day: 32,
      tasks: [
        {
          title: "Found mode for the report form",
          status: "done",
          who: "isha",
          commits: [C("{T}: found mode for report form", "isha", ["src/items/ReportForm.tsx", "src/items/found.ts"], 112, 35, 22)],
        },
        {
          title: "Drop-off points list",
          status: "done",
          who: "kabir",
          commits: [C("{T}: drop-off points seed data", "kabir", ["db/migrations/005_dropoff.sql"], 40, 0, 21)],
        },
      ],
    },
    {
      title: "Search and filter items",
      narrative: "As a student, I want to search lost and found items by words, category, place and date, so that I can find my thing in seconds.",
      acceptance: [
        "Given 500 items, when I type “blue bottle”, then matching items show in under 300 ms.",
        "Given a typo like “botle”, when I search, then “bottle” still matches.",
        "Given category and date filters, when I apply both, then only items matching both show.",
      ],
      priority: "must",
      by: "isha",
      day: 31,
      tasks: [
        {
          title: "Search box with fuzzy matching",
          status: "done",
          who: "isha",
          commits: [
            C("{T}: trigram index for item titles", "isha", ["db/migrations/006_search.sql"], 28, 0, 19),
            C("{T}: search box with debounce", "isha", ["src/search/SearchBox.tsx"], 120, 0, 18),
            C("{T}: highlight matched words", "isha", ["src/search/highlight.ts"], 45, 6, 16),
          ],
        },
        {
          title: "Category and date filters",
          status: "doing",
          who: "isha",
          commits: [
            C("{T}: category filter chips", "isha", ["src/search/Filters.tsx"], 90, 0, 1.4),
            C("{T}: date range filter", "isha", ["src/search/Filters.tsx", "src/search/dates.ts"], 74, 12, 0.25),
          ],
        },
      ],
    },
    {
      title: "Item detail page",
      narrative: "As a student, I want an item page with photo, place, date and status, so that I can decide if it's mine.",
      acceptance: [
        "Given an item link, when I open it, then I see the photo, place, date and status.",
        "Given a claimed item, when I open it, then the status says Claimed and the claim button is gone.",
      ],
      priority: "must",
      by: "meera",
      day: 30,
      tasks: [
        {
          title: "Item detail page",
          status: "done",
          who: "meera",
          commits: [
            C("{T}: item detail page", "meera", ["src/items/ItemPage.tsx"], 163, 0, 20),
            C("{T}: claimed state on item page", "meera", ["src/items/ItemPage.tsx"], 24, 9, 8),
          ],
        },
      ],
    },
    {
      title: "Claim an item with a secret question",
      narrative: "As an owner, I want to answer a question only I would know, so that nobody else can claim my item.",
      acceptance: [
        "Given a found item with a secret question, when I answer correctly, then the finder sees my claim and contact.",
        "Given three wrong answers, when I try again, then I am blocked for an hour.",
      ],
      priority: "should",
      by: "aarav",
      day: 29,
      tasks: [
        {
          title: "Secret question on found items",
          status: "done",
          who: "aarav",
          commits: [C("{T}: secret question field with hashed answer", "aarav", ["src/items/claim.ts", "db/migrations/007_claims.sql"], 152, 10, 14)],
        },
        {
          title: "Claim dialog and wrong-answer limit",
          status: "doing",
          who: "meera",
          commits: [
            C("{T}: claim dialog", "meera", ["src/items/ClaimDialog.tsx"], 140, 0, 3.2),
            C("limit wrong answers on claim dialog", "meera", ["src/items/claim.ts"], 38, 5, 2.1),
          ],
        },
      ],
    },
    {
      title: "Match alerts",
      narrative: "As someone who lost an item, I want to be told when a matching found item is posted, so that I don't have to keep checking.",
      acceptance: [
        "Given my lost item is Electronics near the Library, when a found item in the same category and place is posted within 3 days, then I get an alert.",
        "Given I turned alerts off, when a match is posted, then I get nothing.",
      ],
      priority: "should",
      by: "kabir",
      day: 28,
      tasks: [
        {
          title: "Matching rule for lost and found items",
          status: "done",
          who: "aarav",
          commits: [C("{T}: match by category, place and 3-day window", "aarav", ["src/notify/match.ts", "tests/match.test.ts"], 171, 0, 12)],
        },
        {
          title: "Email template for match alerts",
          status: "done",
          who: "meera",
          commits: [C("{T}: match alert email template", "meera", ["src/notify/templates/match.html", "src/notify/send.ts"], 96, 0, 10)],
        },
        { title: "Push notifications for matches", status: "todo", who: "kabir", commits: [] },
      ],
    },
    {
      title: "Moderation queue for the security office",
      narrative: "As the campus security office, I want to hide spam or unsafe posts, so that the board stays useful.",
      acceptance: [
        "Given a post reported twice, when I open the queue, then it is at the top.",
        "Given I hide a post, when students search, then it no longer appears.",
      ],
      priority: "should",
      by: "aarav",
      day: 27,
      tasks: [
        { title: "Report post button", status: "todo", who: "kabir", commits: [] },
        { title: "Moderation queue page", status: "todo", who: "aarav", commits: [] },
      ],
    },
    {
      title: "Map of drop-off points",
      narrative: "As a student, I want to see drop-off points on a campus map, so that I can find where to collect an item.",
      acceptance: ["Given the Found list, when I open the map, then each drop-off point shows its item count."],
      priority: "could",
      by: "kabir",
      day: 26,
      tasks: [],
    },
    {
      title: "Weekly digest email",
      narrative: "As a student, I want a weekly email of unclaimed items, so that I notice things without opening the app.",
      acceptance: ["Given unclaimed items this week, when Monday 9 am comes, then subscribers get one digest email."],
      priority: "could",
      by: "meera",
      day: 26,
      tasks: [],
    },
  ],
  extra: [
    C("fix upload crash on heic photos", "meera", ["src/items/upload.ts"], 22, 4, 23),
    C("eslint and prettier config", "kabir", [".eslintrc.json", ".prettierrc"], 14, 2, 28),
    C("readme: setup steps", "kabir", ["README.md"], 41, 0, 15),
    C("Merge branch 'search'", "isha", [], 0, 0, 16),
    C("more tests for college domain check", "kabir", ["tests/auth.test.ts"], 48, 2, 11),
  ],
  messages: [
    { who: "aarav", day: 33.2, body: "Okay team, SE lab project is locked: campus lost & found. First stories are in Trace, LF-1 is sign-in." },
    { who: "isha", day: 33.1, body: "I'll take reporting and search, I've done forms before" },
    { who: "meera", day: 33.05, body: "I can do photos and the item pages" },
    { who: "kabir", day: 33, body: "I'll do notifications then" },
    { who: "aarav", day: 32.3, body: "Supabase or Firebase? Leaning Supabase, we need joins to match lost vs found items" },
    { who: "isha", day: 32.25, body: "+1, the Firebase rules in our prototype were a mess" },
    { who: "aarav", day: 32.2, body: "/decide Use Supabase instead of Firebase. We need SQL joins for matching and row-level security per user." },
    { who: "aarav", day: 31.4, body: "Should sign-in be college email only?" },
    { who: "meera", day: 31.35, body: "yes, the security office asked for that when we met them" },
    { who: "meera", day: 24.5, body: "photos from phones are like 6 MB each. compressing to webp at 1280px, comes out ~200 KB" },
    { who: "isha", day: 24.45, body: "nice, that keeps us inside the free storage too" },
    { who: "isha", day: 18.6, body: "search is live, try typing “botle” 😄" },
    { who: "aarav", day: 18.55, body: "trigrams ftw" },
    { who: "kabir", day: 13.4, body: "for match alerts I think push is best, nobody reads college email" },
    { who: "aarav", day: 12.3, body: "push needs a service worker + FCM setup, that's a lot before the demo" },
    { who: "kabir", day: 12.25, body: "hmm ok let me check" },
    { who: "aarav", day: 9.2, body: "going with email alerts for v1, logged it as a decision" },
    { who: "meera", day: 3.1, body: "claim dialog done, adding the wrong-answer limit now" },
    { who: "isha", day: 5.2, body: "@Kabir any update on push? that task is still in todo" },
    { who: "kabir", day: 4.4, body: "sorry, CN assignment week. will pick it up this weekend" },
    { who: "aarav", day: 2.1, body: "Mentor review on Friday. Let's finish the filters and close the claim flow before that" },
    { who: "meera", day: 1.2, body: "Kabir raised a dispute on my alert template commit. fair, we paired on it in the lab" },
  ],
  decisions: [
    {
      title: "Use Supabase instead of Firebase",
      rationale: "We need SQL joins to match lost and found items, and row-level security so students only edit their own posts. Firebase rules got messy in the prototype.",
      alternatives: "Firebase (the team already knew it); Express + MySQL (more to host and secure)",
      by: "aarav",
      day: 32.2,
      fromMessage: 6,
    },
    {
      title: "Only @nmims.edu.in emails can sign in",
      rationale: "Keeps the board campus-only and gives the security office someone to contact about each post. Guest access can come later.",
      alternatives: "Any Google account; roll-number login",
      by: "aarav",
      day: 31.3,
      story: 0,
    },
    {
      title: "Compress photos to WebP at 1280 px",
      rationale: "Phone photos are 4–8 MB. WebP at 1280 px is about 200 KB and still shows labels and stickers clearly, which keeps us inside the free 1 GB storage.",
      alternatives: "Store originals; resize on the server",
      by: "meera",
      day: 24.4,
      story: 1,
    },
    {
      title: "Fuzzy search with Postgres trigrams, not Algolia",
      rationale: "Typos like “botle” must still match. pg_trgm does that inside the database for free; Algolia's free tier caps records and adds a second service to run.",
      alternatives: "Algolia; plain ILIKE matching",
      by: "isha",
      day: 19,
      story: 3,
    },
    {
      title: "Hash secret answers like passwords",
      rationale: "Finders write the question and owners type the answer. Storing answers hashed means nobody can read them, even if the database leaks.",
      alternatives: "Plain text; encrypt with an app key",
      by: "aarav",
      day: 14,
      story: 5,
    },
    {
      title: "Send push notifications for matches",
      rationale: "Students check their phones, not email. Push notifications reach them fastest when a matching item is posted.",
      alternatives: "Email alerts; SMS",
      by: "kabir",
      day: 13.3,
      story: 6,
    },
    {
      title: "Email only for match alerts in v1",
      rationale: "Push notifications need a service worker and Firebase Cloud Messaging setup we don't have time for before the demo. Email alerts for matches are enough for v1.",
      alternatives: "Push notifications (Kabir's plan); in-app badge only",
      by: "aarav",
      day: 9.2,
      story: 6,
    },
  ],
  disputes: [
    {
      on: "commit",
      match: "match alert email template",
      subject: "meera",
      by: "kabir",
      note: "We paired on this in the lab. I wrote the email copy and the subject lines; Meera pushed it.",
      day: 3,
    },
    {
      on: "task",
      match: "Drop-off points list",
      subject: "kabir",
      by: "isha",
      note: "The list of drop-off points came from the security office sheet that I collected. Kabir turned it into the migration.",
      day: 6,
      resolution: "Agreed: Isha gathered the data, Kabir wrote the migration.",
    },
  ],
};

// The other four teams are generated from a shorter spec, each with a different
// problem a mentor should spot in thirty seconds.

type Short = {
  key: string;
  name: string;
  owner: string;
  members: string[];
  weights: Record<string, number>;
  orphanRate: number;
  idle: number; // days since the last activity
  balanced?: boolean; // hand tasks out in turn instead of by weight
  stories: { title: string; narrative: string; acceptance: string[]; priority: Story["priority"]; module: string; tasks: [string, Task["status"]][] }[];
  decisions: DecisionSpec[];
  messages: MessageSpec[];
  disputes: DisputeSpec[];
};

const shortTeams: Short[] = [
  {
    key: "MB",
    name: "Hostel Mess Feedback",
    owner: "rohan",
    members: ["tanvi", "aditya", "sneha"],
    weights: { rohan: 0.8, tanvi: 0.08, aditya: 0.07, sneha: 0.05 },
    orphanRate: 0.15,
    idle: 1,
    stories: [
      { title: "Rate today's meal", narrative: "As a hosteller, I want to rate each meal from 1 to 5, so that the mess committee sees what works.", acceptance: ["Given it's after lunch, when I rate lunch, then my rating is saved once per meal.", "Given I rated already, when I rate again, then my old rating is replaced."], priority: "must", module: "ratings", tasks: [["Rating widget", "done"], ["One rating per meal rule", "done"]] },
      { title: "Weekly menu board", narrative: "As a hosteller, I want to see this week's menu, so that I can plan when to eat out.", acceptance: ["Given the warden uploads a menu, when I open the app, then today's meals show first."], priority: "must", module: "menu", tasks: [["Menu upload for the warden", "done"], ["Today-first menu view", "done"]] },
      { title: "Anonymous complaints", narrative: "As a hosteller, I want to complain anonymously, so that I'm not singled out by the mess staff.", acceptance: ["Given I submit a complaint, when the committee reads it, then my name is not shown."], priority: "should", module: "complaints", tasks: [["Complaint form", "done"], ["Strip names before saving", "doing"]] },
      { title: "Committee dashboard", narrative: "As a mess committee member, I want average ratings per dish over time, so that we can drop dishes nobody likes.", acceptance: ["Given four weeks of ratings, when I open the dashboard, then I see a trend line per dish."], priority: "should", module: "dashboard", tasks: [["Ratings trend chart", "doing"], ["Export ratings as CSV", "todo"]] },
      { title: "Sign in with hostel ID", narrative: "As a hosteller, I want to sign in with my hostel ID, so that only residents can rate.", acceptance: ["Given a valid hostel ID, when I sign in, then I land on today's menu."], priority: "must", module: "auth", tasks: [["Hostel ID sign-in", "done"]] },
      { title: "Dish requests", narrative: "As a hosteller, I want to suggest a dish, so that the menu reflects what students want.", acceptance: ["Given a suggestion, when ten students upvote it, then the committee is notified."], priority: "could", module: "requests", tasks: [] },
    ],
    decisions: [
      { title: "Ratings are 1 to 5 stars, no comments", rationale: "Comments turned into arguments in the pilot. Stars are quick to give after a meal and easy to average.", alternatives: "Thumbs up/down; free-text reviews", by: "rohan", day: 25 },
      { title: "Complaints never store the student's name", rationale: "Students told us they won't complain if mess staff can trace it back. We store only the hostel block.", alternatives: "Store names but hide them in the UI", by: "rohan", day: 20 },
    ],
    messages: [
      { who: "rohan", day: 30, body: "I've set up the repo and the first stories. I'll handle most of the backend" },
      { who: "tanvi", day: 21, body: "can I take the dashboard?" },
      { who: "rohan", day: 20.9, body: "I already started it, you can do CSV export later" },
      { who: "sneha", day: 9, body: "what should I pick up?" },
      { who: "rohan", day: 1.3, body: "pushed the trend chart, review pls" },
    ],
    disputes: [],
  },
  {
    key: "LB",
    name: "Lab Slot Booking",
    owner: "vikram",
    members: ["ananya", "farhan", "priya"],
    weights: { vikram: 0.3, ananya: 0.3, farhan: 0.2, priya: 0.2 },
    orphanRate: 0.75,
    idle: 7,
    stories: [
      { title: "Book a lab slot", narrative: "As a student, I want to book a free lab slot, so that I don't wait outside a full lab.", acceptance: ["Given a free slot, when I book it, then it shows as mine and others can't book it."], priority: "must", module: "booking", tasks: [["Slot grid", "done"], ["Booking with clash check", "doing"]] },
      { title: "Cancel or swap a slot", narrative: "As a student, I want to cancel or swap my slot, so that someone else can use it.", acceptance: ["Given my booking, when I cancel it up to an hour before, then the slot frees up."], priority: "must", module: "booking", tasks: [["Cancel booking", "todo"], ["Swap requests", "todo"]] },
      { title: "Lab in-charge approval", narrative: "As a lab in-charge, I want to approve bookings for the project lab, so that equipment isn't overbooked.", acceptance: ["Given a project-lab booking, when I approve it, then the student is notified."], priority: "should", module: "approval", tasks: [["Approval queue", "todo"]] },
      { title: "Slot reminders", narrative: "As a student, I want a reminder before my slot, so that I don't miss it.", acceptance: ["Given a booking, when it's 30 minutes away, then I get a reminder."], priority: "should", module: "reminders", tasks: [] },
      { title: "Sign in with SAP ID", narrative: "As a student, I want to sign in with my SAP ID, so that bookings are tied to me.", acceptance: ["Given a valid SAP ID, when I sign in, then I see my bookings."], priority: "must", module: "auth", tasks: [["SAP ID sign-in", "done"]] },
      { title: "Usage report for the HOD", narrative: "As the HOD, I want monthly lab usage, so that I can plan lab hours.", acceptance: ["Given a month of bookings, when I open the report, then I see usage per lab."], priority: "could", module: "reports", tasks: [] },
    ],
    decisions: [
      { title: "Slots are one hour, booked up to a week ahead", rationale: "Lab timetables run in hour blocks, and a week ahead stops people hoarding slots for the whole month.", alternatives: "30-minute slots; booking a month ahead", by: "vikram", day: 26 },
    ],
    messages: [
      { who: "vikram", day: 28, body: "repo is up, I'll push the slot grid tonight" },
      { who: "ananya", day: 14, body: "pushed a bunch of fixes, didn't tag the stories sorry" },
      { who: "farhan", day: 8, body: "exams this week, will continue after" },
    ],
    disputes: [],
  },
  {
    key: "CB",
    name: "Campus Carpool",
    owner: "neha",
    members: ["arjun", "zoya", "siddharth"],
    weights: { neha: 0.25, arjun: 0.25, zoya: 0.25, siddharth: 0.25 },
    orphanRate: 0.08,
    idle: 0,
    balanced: true,
    stories: [
      { title: "Offer a ride", narrative: "As a student with a car, I want to offer seats on my drive to campus, so that I can split fuel.", acceptance: ["Given I offer 3 seats from Kothur at 8 am, when others search, then my ride shows with 3 seats."], priority: "must", module: "rides", tasks: [["Offer ride form", "done"], ["Seat count updates", "done"]] },
      { title: "Find a ride", narrative: "As a student, I want to find rides from my area, so that I don't take two buses.", acceptance: ["Given rides from my area tomorrow, when I search, then I see them sorted by time."], priority: "must", module: "search", tasks: [["Ride search by area and time", "done"], ["Map preview of the route", "done"]] },
      { title: "Request to join", narrative: "As a rider, I want to request a seat, so that the driver can accept me.", acceptance: ["Given a ride with free seats, when I request one, then the driver sees my request.", "Given the driver accepts, when I open the ride, then I see the pickup point."], priority: "must", module: "requests", tasks: [["Seat requests", "done"], ["Accept and reject", "done"]] },
      { title: "Split fuel cost", narrative: "As a driver, I want the fuel cost split per rider, so that nobody argues about money.", acceptance: ["Given 3 riders and ₹300 fuel, when the ride ends, then each rider owes ₹75 including me."], priority: "should", module: "payments", tasks: [["Cost split calculator", "done"], ["UPI link per rider", "doing"]] },
      { title: "Verified college profiles", narrative: "As a rider, I want to see that a driver is a verified student, so that I feel safe.", acceptance: ["Given a driver with a college email, when I view the ride, then I see a verified badge."], priority: "must", module: "auth", tasks: [["College email verification", "done"]] },
      { title: "Share live location", narrative: "As a rider, I want to share my live location with a friend during a ride, so that someone knows where I am.", acceptance: ["Given an active ride, when I tap share, then my friend gets a live link for that ride only."], priority: "should", module: "safety", tasks: [["Live location share link", "done"]] },
    ],
    decisions: [
      { title: "Riders pay the driver directly over UPI", rationale: "Holding money in the app needs a payment licence and refunds. A UPI link per rider keeps us out of that.", alternatives: "Razorpay wallet; cash only", by: "neha", day: 18, story: 3 },
      { title: "Location links expire when the ride ends", rationale: "Live location is sensitive; a link that dies with the ride means nothing leaks afterwards.", alternatives: "Links valid for 24 hours", by: "zoya", day: 10, story: 5 },
    ],
    messages: [
      { who: "neha", day: 29, body: "everyone take one story each, we'll swap reviews" },
      { who: "arjun", day: 20, body: "search + map done, Zoya can you review?" },
      { who: "zoya", day: 19.8, body: "reviewed, two small comments" },
      { who: "siddharth", day: 3, body: "UPI links work on GPay and PhonePe, testing Paytm" },
    ],
    disputes: [],
  },
  {
    key: "EV",
    name: "Club Events Hub",
    owner: "riya",
    members: ["karan", "ishaan", "pooja"],
    weights: { riya: 0.35, karan: 0.3, ishaan: 0.25, pooja: 0.1 },
    orphanRate: 0.2,
    idle: 2,
    stories: [
      { title: "Publish an event", narrative: "As a club lead, I want to publish an event with a poster, so that students find it in one place.", acceptance: ["Given a title, date, venue and poster, when I publish, then the event shows on the home feed."], priority: "must", module: "events", tasks: [["Event form with poster", "done"], ["Home feed", "done"]] },
      { title: "Register for an event", narrative: "As a student, I want to register in one tap, so that I don't fill a new Google Form every time.", acceptance: ["Given I'm signed in, when I tap Register, then I'm on the list and get a confirmation."], priority: "must", module: "registration", tasks: [["One-tap registration", "done"], ["Registration limit per event", "doing"]] },
      { title: "QR check-in", narrative: "As a volunteer, I want to scan a QR code at the door, so that attendance is recorded.", acceptance: ["Given a registered student's QR, when I scan it, then they are marked present once."], priority: "should", module: "checkin", tasks: [["QR code per registration", "done"], ["Scanner page", "doing"]] },
      { title: "Club pages", narrative: "As a student, I want a page per club with its past events, so that I can decide what to join.", acceptance: ["Given a club, when I open its page, then I see its leads and past events."], priority: "should", module: "clubs", tasks: [["Club page", "todo"]] },
      { title: "Sign in for club leads", narrative: "As a club lead, I want my own login, so that only I can publish for my club.", acceptance: ["Given I'm a lead, when I sign in, then I can publish only for my club."], priority: "must", module: "auth", tasks: [["Lead roles", "done"]] },
      { title: "Attendance certificates", narrative: "As a student, I want a certificate after attending, so that I can add it to my CV.", acceptance: ["Given I attended, when the event ends, then I can download a PDF certificate."], priority: "could", module: "certificates", tasks: [] },
    ],
    decisions: [
      { title: "Use Google Forms for event registration", rationale: "Clubs already use Google Forms for registration; embedding the form is the fastest way to ship.", alternatives: "Build registration in the app", by: "karan", day: 24, story: 1 },
      { title: "Build registration in the app, no Google Forms", rationale: "Google Forms registration can't do one-tap sign-up or QR check-in, and students hate refilling forms for every event.", alternatives: "Keep embedding Google Forms", by: "riya", day: 16, story: 1 },
      { title: "One QR code per registration, not per student", rationale: "A per-registration code can't be reused at another event, so attendance can't be faked.", alternatives: "One QR per student ID", by: "ishaan", day: 9, story: 2 },
    ],
    messages: [
      { who: "riya", day: 27, body: "events hub kickoff! I'll do publishing, Karan registration" },
      { who: "karan", day: 24.1, body: "embedding google forms for now, quickest" },
      { who: "riya", day: 16.1, body: "we can't do QR check-in with forms, I'm moving registration in-app" },
      { who: "karan", day: 16, body: "ok but I already built the forms embed 😐" },
      { who: "pooja", day: 4, body: "who's doing club pages? it's still unassigned in todo" },
    ],
    disputes: [
      { on: "commit", match: "one-tap registration", subject: "riya", by: "karan", note: "Most of this is my forms-embed code moved over. I'd like co-credit.", day: 5 },
      { on: "task", match: "QR code per registration", subject: "ishaan", by: "pooja", note: "I designed the QR flow and tested it at the club fair; Ishaan only merged it.", day: 3 },
    ],
  },
];

function expand(s: Short): Team {
  const r = rng(s.key);
  const all = [s.owner, ...s.members];
  const pick = () => {
    let x = r();
    for (const k of all) {
      x -= s.weights[k];
      if (x <= 0) return k;
    }
    return s.owner;
  };
  const verbs = ["", "tests for ", "polish ", "fix edge cases in "];
  let turn = 0;
  const span = 28 - s.idle;
  const stories: StorySpec[] = s.stories.map((st, i) => ({
    title: st.title,
    narrative: st.narrative,
    acceptance: st.acceptance,
    priority: st.priority,
    by: i % 2 ? s.members[i % s.members.length] : s.owner,
    day: 31 - i * 0.4,
    tasks: st.tasks.map(([title, status]) => {
      const who = s.balanced ? all[turn++ % all.length] : pick();
      const n = status === "todo" ? 0 : 1 + Math.floor(r() * 3);
      return {
        title,
        status,
        who,
        commits: Array.from({ length: n }, (_, k) => {
          const author = s.balanced || r() < 0.75 ? who : pick();
          const text = `${verbs[k % verbs.length]}${title.toLowerCase()}`;
          const named = r() >= s.orphanRate;
          return C(
            named ? `{T}: ${text}` : text,
            author,
            [`src/${st.module}/${title.split(" ")[0].toLowerCase()}${k ? `-${k}` : ""}.ts`, ...(k === 1 ? [`tests/${st.module}.test.ts`] : [])],
            20 + Math.floor(r() * 160),
            Math.floor(r() * 30),
            s.idle + 0.2 + r() * span,
          );
        }),
      };
    }),
  }));
  const extra = Array.from({ length: Math.round(3 + s.orphanRate * 8) }, (_, i) =>
    C(["wip", "fix build", "update readme", "cleanup", "lint fixes", "rename files", "fix typo"][i % 7], pick(), [i % 2 ? "README.md" : "package.json"], 3 + Math.floor(r() * 20), Math.floor(r() * 5), s.idle + 0.1 + r() * span),
  );
  return { key: s.key, name: s.name, course: "SE Lab, Sem V", owner: s.owner, members: s.members, stories, extra, decisions: s.decisions, messages: s.messages, disputes: s.disputes };
}

const teams = [lostAndFound, ...shortTeams.map(expand)];

// --- SQL ------------------------------------------------------------------------

const out: string[] = [];
const stats: string[] = [];
const emit = (s: string) => out.push(s);

emit(`-- Generated by scripts/seed-demo.ts. Do not edit by hand.
-- Fictional demo people and teams. Demo logins get their passwords from a
-- separate, uncommitted step; everyone else has a random, unknown password.

create or replace function public.ensure_demo_user(p_id uuid, p_email text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', p_name), now(), now(), '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now())
  on conflict do nothing;
end $$;
revoke execute on function public.ensure_demo_user(uuid, text, text) from public, anon, authenticated;
`);

for (const p of people) emit(`select public.ensure_demo_user(${q(uid(p.key))}, ${q(email(p))}, ${q(p.name)});`);

const body: string[] = [];
const B = (s: string) => body.push(s);
const demoIds = people.map((p) => q(uid(p.key))).join(", ");
B(`  -- Wipe every demo workspace, plus anything visitors made while signed in as a demo person.`);
B(`  delete from public.workspaces where demo or created_by in (${demoIds});`);
B(`  delete from public.members where user_id in (${demoIds});`);
for (const p of people) {
  B(`  update public.profiles set name = ${q(p.name)}, github = ${q(p.github)}, hue = ${p.hue} where id = ${q(uid(p.key))};`);
}

for (const t of teams) {
  const ws = uuid(`ws:${t.key}`);
  const r = rng(`sha:${t.key}`);
  const sha = () => Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
  let n = 0;
  const stories: Story[] = [];
  const tasks: Task[] = [];
  const commits: Commit[] = [];
  const commitAge = new Map<string, number>();
  // Minutes ago each done task was closed: shortly after its last commit.
  const doneAge = new Map<string, number>();
  const storyIds: string[] = [];

  t.stories.forEach((s, si) => {
    const sid = uuid(`story:${t.key}:${si}`);
    storyIds.push(sid);
    const sn = ++n;
    stories.push({ id: sid, number: sn, title: s.title, narrative: s.narrative, acceptance: s.acceptance.join("\n"), priority: s.priority, created_by: uid(s.by), created_at: String(s.day) });
    s.tasks.forEach((tk, ti) => {
      const tid = uuid(`task:${t.key}:${si}:${ti}`);
      const tn = ++n;
      const tref = `${t.key}-${tn}`;
      const commitDays = tk.commits.map((c) => c.day);
      tasks.push({ id: tid, number: tn, story_id: sid, title: tk.title, status: tk.status, assignee: uid(tk.who), created_by: uid(s.by), created_at: String(s.day - 0.5), done_at: null });
      if (tk.status === "done") doneAge.set(tid, Math.max(0, (commitDays.length ? Math.min(...commitDays) : s.day - 2) * DAY - 90));
      tk.commits.forEach((c, ci) => {
        const id = uuid(`commit:${t.key}:${si}:${ti}:${ci}`);
        commits.push({ id, sha: sha(), message: c.msg.replace("{T}", tref), author_login: person.get(c.who)!.github, author_name: person.get(c.who)!.name, user_id: uid(c.who), additions: c.add, deletions: c.del, files: c.files, detailed: true, url: null, committed_at: "" });
        commitAge.set(id, c.day * DAY);
      });
    });
  });
  t.extra.forEach((c, i) => {
    const id = uuid(`commit:${t.key}:extra:${i}`);
    commits.push({ id, sha: sha(), message: c.msg, author_login: person.get(c.who)!.github, author_name: person.get(c.who)!.name, user_id: uid(c.who), additions: c.add, deletions: c.del, files: c.files, detailed: true, url: null, committed_at: "" });
    commitAge.set(id, c.day * DAY);
  });

  const links: Link[] = linkCommits({ key: t.key, commits, stories, tasks, links: [] }).map((l, i) => ({ id: uuid(`link:${t.key}:${i}`), ...l }));

  B(`\n  -- ${t.name} (${t.key})`);
  B(`  insert into public.workspaces (id, name, key, course, demo, seq, dseq, created_by, created_at) values (${q(ws)}, ${q(t.name)}, ${q(t.key)}, ${q(t.course)}, true, ${n}, ${t.decisions.length}, ${q(uid(t.owner))}, ${ago(34 * DAY)});`);
  const mem = [`(${q(ws)}, ${q(uid(t.owner))}, 'owner', ${ago(34 * DAY)})`, ...t.members.map((m) => `(${q(ws)}, ${q(uid(m))}, 'member', ${ago(33.5 * DAY)})`), `(${q(ws)}, ${q(uid("nair"))}, 'mentor', ${ago(33 * DAY)})`];
  B(`  insert into public.members (workspace_id, user_id, role, joined_at) values\n    ${mem.join(",\n    ")};`);
  B(`  insert into public.stories (id, workspace_id, number, title, narrative, acceptance, priority, created_by, created_at) values\n    ${stories.map((s) => `(${q(s.id)}, ${q(ws)}, ${s.number}, ${q(s.title)}, ${q(s.narrative)}, ${q(s.acceptance)}, ${q(s.priority)}, ${q(s.created_by)}, ${ago(Number(s.created_at) * DAY)})`).join(",\n    ")};`);
  if (tasks.length) {
    B(`  insert into public.tasks (id, workspace_id, story_id, number, title, status, assignee, created_by, created_at, done_at) values\n    ${tasks
      .map((k) => {
        const done = doneAge.get(k.id) ?? null;
        return `(${q(k.id)}, ${q(ws)}, ${q(k.story_id)}, ${k.number}, ${q(k.title)}, ${q(k.status)}, ${q(k.assignee)}, ${q(k.created_by)}, ${ago(Number(k.created_at) * DAY)}, ${done === null ? "null" : ago(done)})`;
      })
      .join(",\n    ")};`);
  }
  B(`  insert into public.commits (id, workspace_id, sha, message, author_login, author_name, user_id, additions, deletions, files, detailed, committed_at) values\n    ${commits
    .map((c) => `(${q(c.id)}, ${q(ws)}, ${q(c.sha)}, ${q(c.message)}, ${q(c.author_login)}, ${q(c.author_name)}, ${q(c.user_id)}, ${c.additions}, ${c.deletions}, ${c.files.length ? `array[${c.files.map(q).join(", ")}]` : "'{}'"}::text[], true, ${ago(commitAge.get(c.id)!)})`)
    .join(",\n    ")};`);
  if (links.length) {
    B(`  insert into public.links (id, workspace_id, commit_id, story_id, task_id, source, status, score, reason, created_by) values\n    ${links
      .map((l) => `(${q(l.id)}, ${q(ws)}, ${q(l.commit_id)}, ${q(l.story_id)}, ${q(l.task_id)}, ${q(l.source)}, ${q(l.status)}, ${l.score ?? "null"}, ${q(l.reason)}, null)`)
      .join(",\n    ")};`);
  }
  const msgIds = t.messages.map((_, i) => uuid(`msg:${t.key}:${i}`));
  if (t.messages.length) {
    B(`  insert into public.messages (id, workspace_id, user_id, story_id, body, created_at) values\n    ${t.messages
      .map((m, i) => `(${q(msgIds[i])}, ${q(ws)}, ${q(uid(m.who))}, ${m.story === undefined ? "null" : q(storyIds[m.story])}, ${q(m.body)}, ${ago(m.day * DAY)})`)
      .join(",\n    ")};`);
  }
  const decIds = t.decisions.map((_, i) => uuid(`dec:${t.key}:${i}`));
  if (t.decisions.length) {
    B(`  insert into public.decisions (id, workspace_id, number, title, rationale, alternatives, story_id, message_id, supersedes, decided_by, created_at) values\n    ${t.decisions
      .map((x, i) => `(${q(decIds[i])}, ${q(ws)}, ${i + 1}, ${q(x.title)}, ${q(x.rationale)}, ${q(x.alternatives)}, ${x.story === undefined ? "null" : q(storyIds[x.story])}, ${x.fromMessage === undefined ? "null" : q(msgIds[x.fromMessage])}, ${x.supersedes === undefined ? "null" : q(decIds[x.supersedes])}, ${q(uid(x.by))}, ${ago(x.day * DAY)})`)
      .join(",\n    ")};`);
  }
  for (const [i, x] of t.disputes.entries()) {
    const item = x.on === "commit" ? commits.find((c) => c.message.includes(x.match)) : tasks.find((k) => k.title === x.match);
    if (!item) throw new Error(`dispute target not found: ${x.match}`);
    B(`  insert into public.disputes (id, workspace_id, kind, item_id, subject, raised_by, note, status, resolution, created_at, resolved_at) values (${q(uuid(`dispute:${t.key}:${i}`))}, ${q(ws)}, ${q(x.on)}, ${q(item.id)}, ${q(uid(x.subject))}, ${q(uid(x.by))}, ${q(x.note)}, ${x.resolution ? "'resolved'" : "'open'"}, ${q(x.resolution ?? null)}, ${ago(x.day * DAY)}, ${x.resolution ? ago(x.day * DAY - 300) : "null"});`);
  }
  B(`  insert into public.sync_state (workspace_id, synced_at) values (${q(ws)}, ${ago(30)});`);

  // What the splash page and README quote about the demo: computed, not invented.
  const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const members: Member[] = [t.owner, ...t.members].map((k) => ({
    user_id: uid(k),
    role: k === t.owner ? "owner" : "member",
    joined_at: iso(34 * DAY),
    profile: { id: uid(k), name: person.get(k)!.name, github: person.get(k)!.github, hue: person.get(k)!.hue },
  }));
  const decisions: Decision[] = t.decisions.map((x, i) => ({
    id: decIds[i], number: i + 1, title: x.title, rationale: x.rationale, alternatives: x.alternatives,
    story_id: x.story === undefined ? null : storyIds[x.story], message_id: null,
    supersedes: x.supersedes === undefined ? null : decIds[x.supersedes], decided_by: uid(x.by), created_at: iso(x.day * DAY),
  }));
  const disputes: Dispute[] = t.disputes.map((x, i) => ({
    id: String(i), kind: x.on, item_id: "", subject: uid(x.subject), raised_by: uid(x.by), note: x.note,
    status: x.resolution ? "resolved" : "open", resolution: x.resolution ?? null, created_at: iso(x.day * DAY), resolved_at: null,
  }));
  const h = health(
    {
      key: t.key,
      members,
      stories: stories.map((st) => ({ ...st, created_at: iso(Number(st.created_at) * DAY) })),
      tasks: tasks.map((k) => ({ ...k, created_at: iso(Number(k.created_at) * DAY), done_at: doneAge.has(k.id) ? iso(doneAge.get(k.id)!) : null })),
      commits: commits.map((c) => ({ ...c, committed_at: iso(commitAge.get(c.id)!) })),
      links,
      decisions,
      disputes,
    },
    Date.now(),
  );
  stats.push(
    `${t.key} ${t.name}: traced ${h.coverage.pct}% (${h.coverage.traced}/${h.coverage.total}), balance ${Math.round(h.balance * 100)}%, ` +
      h.team.map((m) => `${members.find((x) => x.user_id === m.user_id)!.profile.name.split(" ")[0]} ${Math.round(m.weight * 100)}%`).join(", ") +
      ` | ${h.flags.map((f) => f.text).join("; ") || "no flags"}`,
  );
}

emit(`
create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = '' as $$
begin
${body.join("\n")}
end $$;
revoke execute on function public.reset_demo() from public, anon, authenticated;

select public.reset_demo();
`);

writeFileSync(new URL("../supabase/migrations/0002_demo.sql", import.meta.url), out.join("\n") + "\n");
console.log(`wrote 0002_demo.sql: ${teams.length} teams, ${people.length} people`);
console.log(stats.join(String.fromCharCode(10)));
