import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const $ = id => document.getElementById(id);

let currentUser = null;
let signupMode = false;

let cache = {
  problems: [],
  help: [],
  polls: [],
  events: [],
  emergencies: [],
  users: []
};


/* ---------- Utilities ---------- */

function toast(message) {
  const element = $("toast");

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2800);
}


function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]
  );
}


function requireLogin() {
  if (!currentUser) {
    openAuth();
    toast("Please login first");
    return false;
  }

  return true;
}


function fmt(timestamp) {
  if (!timestamp) {
    return "Just now";
  }

  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}


function isHead() {
  return (
    currentUser?.email?.toLowerCase() === "head@panchayat.com" ||
    currentUser?.uid === "SOCIETY_HEAD_UID"
  );
}


function getUserName() {
  return currentUser?.displayName || currentUser?.email || "Resident";
}


/* ---------- Navigation ---------- */

document.querySelectorAll("[data-page]").forEach(button => {
  button.onclick = () => showPage(button.dataset.page);
});


function showPage(id) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const page = $(id);

  if (page) {
    page.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ---------- Authentication ---------- */

$("loginBtn").onclick = openAuth;

$("logoutBtn").onclick = async () => {
  await signOut(auth);
  toast("Logged out");
};


$("closeAuth").onclick = () => {
  $("authModal").classList.add("hidden");
};


$("toggleAuth").onclick = () => {
  signupMode = !signupMode;
  updateAuthMode();
};


function updateAuthMode() {
  $("authTitle").textContent = signupMode
    ? "Create your account"
    : "Welcome back";

  $("authSubmit").textContent = signupMode
    ? "Create account"
    : "Login";

  $("authSwitchText").textContent = signupMode
    ? "Already have an account?"
    : "New here?";

  $("toggleAuth").textContent = signupMode
    ? "Login"
    : "Create account";

  $("authName").classList.toggle(
    "hidden",
    !signupMode
  );

  $("authName").required = signupMode;
}


function openAuth() {
  $("authModal").classList.remove("hidden");
  $("authError").textContent = "";
}


$("authForm").onsubmit = async event => {
  event.preventDefault();

  $("authError").textContent = "";

  try {
    if (signupMode) {
      const name = $("authName").value.trim();
      const email = $("authEmail").value.trim();
      const password = $("authPassword").value;

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      await updateProfile(credential.user, {
        displayName: name
      });

      await setDoc(
        doc(db, "users", credential.user.uid),
        {
          name,
          email: credential.user.email,
          role: "resident",
          points: 0,
          helpsCompleted: 0,
          emergenciesResponded: 0,
          createdAt: serverTimestamp()
        }
      );

      toast("Account created");
    } else {
      await signInWithEmailAndPassword(
        auth,
        $("authEmail").value.trim(),
        $("authPassword").value
      );

      toast("Logged in");
    }

    $("authModal").classList.add("hidden");
    $("authForm").reset();
  } catch (error) {
    $("authError").textContent =
      error.message.replace("Firebase: ", "");
  }
};


onAuthStateChanged(auth, async user => {
  currentUser = user;

  $("loginBtn").classList.toggle(
    "hidden",
    !!user
  );

  $("logoutBtn").classList.toggle(
    "hidden",
    !user
  );

  $("userLabel").textContent = user
    ? user.displayName || user.email
    : "Guest";

  document.querySelectorAll(".head-only").forEach(element => {
    element.classList.toggle(
      "hidden",
      !isHead()
    );
  });

  await loadAll();
});


/* ---------- Firestore ---------- */

async function getCollection(name, max = 100) {
  const snapshot = await getDocs(
    query(
      collection(db, name),
      orderBy("createdAt", "desc"),
      limit(max)
    )
  );

  return snapshot.docs.map(documentSnapshot => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data()
  }));
}


async function loadUsers() {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "users"),
        orderBy("points", "desc"),
        limit(20)
      )
    );

    cache.users = snapshot.docs.map(documentSnapshot => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    }));
  } catch (error) {
    console.error("Could not load users", error);
    cache.users = [];
  }
}


async function loadAll() {
  try {
    cache.problems = await getCollection("problems");
    cache.help = await getCollection("helpOffers");
    cache.polls = await getCollection("polls");
    cache.events = await getCollection("events");

    try {
      cache.emergencies =
        await getCollection("emergencyAlerts");
    } catch (error) {
      console.warn("Emergency collection unavailable", error);
      cache.emergencies = [];
    }

    await loadUsers();

    renderAll();
  } catch (error) {
    console.error(error);
    toast(
      "Could not load community data. Check Firebase setup."
    );
  }
}


/* ---------- Rendering ---------- */

function renderAll() {
  $("statProblems").textContent =
    cache.problems.length;

  $("statHelp").textContent =
    cache.help.length;

  $("statEmergencies").textContent =
    cache.emergencies.filter(
      emergency => emergency.status !== "Resolved"
    ).length;

  $("statEvents").textContent =
    cache.events.filter(
      event => new Date(event.date) >= new Date()
    ).length;

  renderProblems();
  renderHomeProblems();
  renderHelp();
  renderPolls();
  renderEvents();
  renderEmergencies();
  renderRewards();
  renderDashboard();
}


function problemHTML(problem) {
  const name = problem.anonymous
    ? "Anonymous resident"
    : escapeHTML(
        problem.authorName || "Resident"
      );

  const status =
    (problem.status || "Open").toLowerCase();

  return `
    <article class="card">
      <span class="tag">
        ${escapeHTML(problem.category || "Other")}
      </span>

      <span class="status ${status === "resolved" ? "resolved" : ""}">
        ${escapeHTML(problem.status || "Open")}
      </span>

      <h3>${escapeHTML(problem.title)}</h3>

      <p>
        ${escapeHTML(problem.description)}
      </p>

      <p class="muted">
        By ${name} · ${fmt(problem.createdAt)}
      </p>
    </article>
  `;
}


function renderProblems() {
  $("problemsList").innerHTML =
    cache.problems.length
      ? cache.problems.map(problemHTML).join("")
      : `
        <div class="card">
          <h3>No problems yet</h3>
          <p class="muted">
            Be the first to report an issue.
          </p>
        </div>
      `;
}


function renderHomeProblems() {
  $("homeProblems").innerHTML =
    cache.problems.slice(0, 3).map(problemHTML).join("")
    ||
    `
      <div class="card">
        <h3>Your community starts here.</h3>
        <p class="muted">
          Report a problem to get started.
        </p>
      </div>
    `;
}


/* ---------- Help System ---------- */

function renderHelp() {
  $("helpList").innerHTML =
    cache.help.map(help => {
      const isOwner =
        currentUser &&
        help.authorId === currentUser.uid;

      const completed =
        help.status === "completed";

      const requested =
        help.status === "requested";

      return `
        <article class="card">
          <span class="tag">
            ${escapeHTML(help.skill)}
          </span>

          <span class="status ${completed ? "resolved" : ""}">
            ${completed
              ? "Completed"
              : requested
                ? "Requested"
                : "Available"}
          </span>

          <h3>${escapeHTML(help.name)}</h3>

          <p>
            ${escapeHTML(
              help.description ||
              "Happy to help a neighbour."
            )}
          </p>

          <p class="muted">
            Contact: ${escapeHTML(help.contact)}
          </p>

          <p class="muted">
            Reward: +25 points after confirmed help
          </p>

          <div class="emergency-actions">
            ${
              !isOwner && !completed && !requested
                ? `
                  <button
                    class="action-button"
                    data-help-request="${help.id}">
                    🤝 I Can Help
                  </button>
                `
                : ""
            }

            ${
              isOwner && requested && !completed
                ? `
                  <button
                    class="action-button"
                    data-help-complete="${help.id}">
                    ✅ Mark Help Completed
                  </button>
                `
                : ""
            }
          </div>
        </article>
      `;
    }).join("")
    ||
    `
      <div class="card">
        <h3>No offers yet</h3>
        <p class="muted">
          Offer a skill to help your neighbours.
        </p>
      </div>
    `;

  document.querySelectorAll("[data-help-request]")
    .forEach(button => {
      button.onclick = () =>
        requestHelp(button.dataset.helpRequest);
    });

  document.querySelectorAll("[data-help-complete]")
    .forEach(button => {
      button.onclick = () =>
        completeHelp(button.dataset.helpComplete);
    });
}


async function requestHelp(helpId) {
  if (!requireLogin()) {
    return;
  }

  const help = cache.help.find(
    item => item.id === helpId
  );

  if (!help) {
    return;
  }

  if (help.authorId === currentUser.uid) {
    toast("You cannot request your own help offer");
    return;
  }

  await updateDoc(
    doc(db, "helpOffers", helpId),
    {
      status: "requested",
      requesterId: currentUser.uid,
      requesterName: getUserName(),
      requestedAt: serverTimestamp()
    }
  );

  toast("Help request sent");

  await loadAll();
}


async function completeHelp(helpId) {
  if (!requireLogin()) {
    return;
  }

  const help = cache.help.find(
    item => item.id === helpId
  );

  if (!help || help.authorId !== currentUser.uid) {
    return;
  }

  if (help.status === "completed") {
    return;
  }

  await updateDoc(
    doc(db, "helpOffers", helpId),
    {
      status: "completed",
      completedAt: serverTimestamp(),
      rewardPoints: 25
    }
  );

  await addPoints(
    currentUser.uid,
    25,
    "Completed help for a neighbour"
  );

  toast("🎉 Help completed! +25 community points");

  await loadAll();
}


/* ---------- Emergency System ---------- */

$("emergencyForm").onsubmit = async event => {
  event.preventDefault();

  if (!requireLogin()) {
    return;
  }

  const emergencyType =
    $("emergencyType").value;

  const location =
    $("emergencyLocation").value.trim();

  const description =
    $("emergencyDescription").value.trim();

  if (!emergencyType || !location || !description) {
    toast("Please complete all emergency fields");
    return;
  }

  await addDoc(
    collection(db, "emergencyAlerts"),
    {
      type: emergencyType,
      location,
      description,
      status: "Active",
      createdBy: currentUser.uid,
      createdByName: getUserName(),
      responderId: "",
      responderName: "",
      createdAt: serverTimestamp()
    }
  );

  $("emergencyForm").reset();

  toast("🚨 Emergency alert sent to the community");

  await loadAll();
};


function renderEmergencies() {
  const activeEmergencies =
    cache.emergencies;

  $("emergencyList").innerHTML =
    activeEmergencies.length
      ? activeEmergencies.map(emergency => {
          const statusClass =
            emergency.status === "Resolved"
              ? "resolved"
              : emergency.status === "Responding"
                ? "responding"
                : "";

          const canRespond =
            currentUser &&
            emergency.createdBy !== currentUser.uid &&
            emergency.status === "Active";

          const canResolve =
            currentUser &&
            (
              emergency.createdBy === currentUser.uid ||
              isHead()
            ) &&
            emergency.status !== "Resolved";

          return `
            <article
              class="card emergency-card ${statusClass}">

              <div class="emergency-meta">
                <span class="emergency-type">
                  🚨 ${escapeHTML(emergency.type)}
                </span>

                <span class="emergency-status ${statusClass}">
                  ${escapeHTML(
                    emergency.status || "Active"
                  )}
                </span>
              </div>

              <h3>
                ${escapeHTML(emergency.location)}
              </h3>

              <p>
                ${escapeHTML(emergency.description)}
              </p>

              <p class="muted">
                Alerted by
                ${escapeHTML(
                  emergency.createdByName ||
                  "Resident"
                )}
                · ${fmt(emergency.createdAt)}
              </p>

              ${
                emergency.responderName
                  ? `
                    <p class="muted">
                      🤝 Responding:
                      <strong>
                        ${escapeHTML(
                          emergency.responderName
                        )}
                      </strong>
                    </p>
                  `
                  : ""
              }

              <div class="emergency-actions">
                ${
                  canRespond
                    ? `
                      <button
                        class="action-button"
                        data-emergency-respond="${emergency.id}">
                        🚑 I'm Responding
                      </button>
                    `
                    : ""
                }

                ${
                  canResolve
                    ? `
                      <button
                        class="action-button"
                        data-emergency-resolve="${emergency.id}">
                        ✅ Mark Resolved
                      </button>
                    `
                    : ""
                }
              </div>
            </article>
          `;
        }).join("")
      : `
        <div class="card">
          <h3>No active emergencies</h3>
          <p class="muted">
            Your community is currently clear.
          </p>
        </div>
      `;

  document.querySelectorAll(
    "[data-emergency-respond]"
  ).forEach(button => {
    button.onclick = () =>
      respondToEmergency(
        button.dataset.emergencyRespond
      );
  });

  document.querySelectorAll(
    "[data-emergency-resolve]"
  ).forEach(button => {
    button.onclick = () =>
      resolveEmergency(
        button.dataset.emergencyResolve
      );
  });
}


async function respondToEmergency(emergencyId) {
  if (!requireLogin()) {
    return;
  }

  const emergency =
    cache.emergencies.find(
      item => item.id === emergencyId
    );

  if (!emergency) {
    return;
  }

  if (
    emergency.status !== "Active" ||
    emergency.createdBy === currentUser.uid
  ) {
    return;
  }

  await updateDoc(
    doc(db, "emergencyAlerts", emergencyId),
    {
      status: "Responding",
      responderId: currentUser.uid,
      responderName: getUserName(),
      respondedAt: serverTimestamp()
    }
  );

  await addPoints(
    currentUser.uid,
    50,
    "Responded to a community emergency"
  );

  toast("🚑 You are responding! +50 points");

  await loadAll();
}


async function resolveEmergency(emergencyId) {
  if (!requireLogin()) {
    return;
  }

  const emergency =
    cache.emergencies.find(
      item => item.id === emergencyId
    );

  if (!emergency) {
    return;
  }

  const allowed =
    emergency.createdBy === currentUser.uid ||
    isHead();

  if (!allowed) {
    toast("Only the alert owner or Society Head can resolve this");
    return;
  }

  await updateDoc(
    doc(db, "emergencyAlerts", emergencyId),
    {
      status: "Resolved",
      resolvedAt: serverTimestamp(),
      resolvedBy: currentUser.uid
    }
  );

  toast("Emergency marked as resolved");

  await loadAll();
}


/* ---------- Reward System ---------- */

async function addPoints(userId, points, reason) {
  const userReference =
    doc(db, "users", userId);

  const existing =
    await getDoc(userReference);

  if (!existing.exists()) {
    await setDoc(
      userReference,
      {
        name: currentUser?.displayName || "Resident",
        email: currentUser?.email || "",
        role: "resident",
        points,
        helpsCompleted: 0,
        emergenciesResponded: 0,
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
  } else {
    await updateDoc(
      userReference,
      {
        points: increment(points),
        lastRewardReason: reason,
        lastRewardAt: serverTimestamp()
      }
    );
  }
}


function renderRewards() {
  const me =
    currentUser
      ? cache.users.find(
          user => user.id === currentUser.uid
        )
      : null;

  const points = me?.points || 0;

  $("myRewardCard").innerHTML = `
    <div>
      <p class="eyebrow" style="color: #d9f2e8;">
        YOUR COMMUNITY IMPACT
      </p>

      <h2>
        ${
          currentUser
            ? `Keep helping, ${escapeHTML(
                currentUser.displayName ||
                "Resident"
              )}!`
            : "Join your community!"
        }
      </h2>

      <p>
        Every useful action helps make your neighbourhood stronger.
      </p>
    </div>

    <div class="reward-points">
      <strong>${points}</strong>
      <span>community points</span>
    </div>
  `;

  const users =
    [...cache.users]
      .sort(
        (a, b) =>
          (b.points || 0) -
          (a.points || 0)
      )
      .slice(0, 10);

  const leaderboardHTML =
    users.map((user, index) => {
      const current =
        currentUser &&
        user.id === currentUser.uid;

      const medals = [
        "🥇",
        "🥈",
        "🥉"
      ];

      return `
        <div class="leaderboard-item ${current ? "current" : ""}">
          <div class="rank">
            ${medals[index] || index + 1}
          </div>

          <div class="avatar">
            ${escapeHTML(
              (user.name || "R")
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div class="leaderboard-info">
            <strong>
              ${escapeHTML(
                user.name || "Resident"
              )}
            </strong>

            <span>
              ${user.helpsCompleted || 0}
              help actions
            </span>
          </div>

          <div class="points">
            ${user.points || 0} pts
          </div>
        </div>
      `;
    }).join("");

  $("leaderboard").innerHTML =
    leaderboardHTML ||
    `
      <div class="card">
        <h3>No community heroes yet</h3>
        <p class="muted">
          Be the first person to help!
        </p>
      </div>
    `;

  $("homeLeaderboard").innerHTML =
    users.slice(0, 3).map((user, index) => `
      <div class="leaderboard-item">
        <div class="rank">
          ${medalsFor(index)}
        </div>

        <div class="avatar">
          ${escapeHTML(
            (user.name || "R")
              .charAt(0)
              .toUpperCase()
          )}
        </div>

        <div class="leaderboard-info">
          <strong>
            ${escapeHTML(
              user.name || "Resident"
            )}
          </strong>

          <span>Community Hero</span>
        </div>

        <div class="points">
          ${user.points || 0}
        </div>
      </div>
    `).join("")
    ||
    `
      <div class="card">
        <h3>No heroes yet</h3>
        <p class="muted">
          Help someone to become a Community Hero.
        </p>
      </div>
    `;
}


function medalsFor(index) {
  return [
    "🥇",
    "🥈",
    "🥉"
  ][index] || index + 1;
}


/* ---------- Polls ---------- */

function renderPolls() {
  $("pollsList").innerHTML =
    cache.polls.map(poll => {
      const total =
        (poll.options || []).reduce(
          (sum, option) =>
            sum + (option.votes || 0),
          0
        );

      return `
        <article class="poll">
          <h3>
            ${escapeHTML(poll.question)}
          </h3>

          <p class="muted">
            ${total} vote(s)
          </p>

          <div class="options">
            ${(poll.options || [])
              .map((option, index) => {
                const percentage =
                  total
                    ? Math.round(
                        (option.votes || 0) *
                        100 /
                        total
                      )
                    : 0;

                return `
                  <button
                    class="option"
                    data-vote="${poll.id}"
                    data-index="${index}">

                    ${escapeHTML(option.text)}

                    <b>
                      ${percentage}%
                    </b>

                    <div class="bar">
                      <span
                        style="width:${percentage}%">
                      </span>
                    </div>
                  </button>
                `;
              })
              .join("")}
          </div>
        </article>
      `;
    }).join("")
    ||
    `
      <div class="card">
        <h3>No polls available.</h3>
      </div>
    `;

  document.querySelectorAll("[data-vote]")
    .forEach(button => {
      button.onclick = () =>
        vote(
          button.dataset.vote,
          Number(button.dataset.index)
        );
    });
}


async function vote(pollId, index) {
  if (!requireLogin()) {
    return;
  }

  const poll =
    cache.polls.find(
      item => item.id === pollId
    );

  if (!poll) {
    return;
  }

  const voted =
    JSON.parse(
      localStorage.getItem(
        "panchayat_votes"
      ) || "{}"
    );

  if (voted[pollId]) {
    toast("You have already voted in this poll");
    return;
  }

  const options =
    poll.options.map((option, optionIndex) =>
      optionIndex === index
        ? {
            ...option,
            votes:
              (option.votes || 0) + 1
          }
        : option
    );

  await updateDoc(
    doc(db, "polls", pollId),
    { options }
  );

  voted[pollId] = true;

  localStorage.setItem(
    "panchayat_votes",
    JSON.stringify(voted)
  );

  toast("Vote recorded");

  await loadAll();
}


/* ---------- Events ---------- */

function renderEvents() {
  $("eventsList").innerHTML =
    cache.events.map(event => `
      <article class="event">
        <div class="event-date">
          ${new Date(event.date).toLocaleString(
            [],
            {
              dateStyle: "medium",
              timeStyle: "short"
            }
          )}
        </div>

        <h3>
          ${escapeHTML(event.title)}
        </h3>

        <p>
          <b>
            📍 ${escapeHTML(event.location)}
          </b>
        </p>

        <p>
          ${escapeHTML(
            event.description || ""
          )}
        </p>
      </article>
    `).join("")
    ||
    `
      <div class="card">
        <h3>No upcoming events.</h3>
      </div>
    `;
}


/* ---------- Problems ---------- */

$("newProblemBtn").onclick = () => {
  if (requireLogin()) {
    $("problemFormWrap")
      .classList.toggle("hidden");
  }
};


$("cancelProblem").onclick = () => {
  $("problemFormWrap")
    .classList.add("hidden");
};


$("problemForm").onsubmit = async event => {
  event.preventDefault();

  if (!requireLogin()) {
    return;
  }

  await addDoc(
    collection(db, "problems"),
    {
      title: $("problemTitle").value.trim(),
      category: $("problemCategory").value,
      description:
        $("problemDescription").value.trim(),
      anonymous:
        $("anonymous").checked,
      authorId: currentUser.uid,
      authorName:
        currentUser.displayName ||
        currentUser.email,
      status: "Open",
      createdAt: serverTimestamp()
    }
  );

  event.target.reset();

  $("problemFormWrap")
    .classList.add("hidden");

  toast("Problem reported");

  await loadAll();
};


/* ---------- Help Form ---------- */

$("newHelpBtn").onclick = () => {
  if (requireLogin()) {
    $("helpFormWrap")
      .classList.toggle("hidden");
  }
};


$("cancelHelp").onclick = () => {
  $("helpFormWrap")
    .classList.add("hidden");
};


$("helpForm").onsubmit = async event => {
  event.preventDefault();

  if (!requireLogin()) {
    return;
  }

  await addDoc(
    collection(db, "helpOffers"),
    {
      skill: $("helpSkill").value.trim(),
      name: $("helpName").value.trim(),
      contact: $("helpContact").value.trim(),
      description:
        $("helpDescription").value.trim(),
      authorId: currentUser.uid,
      authorName: getUserName(),
      status: "available",
      rewardPoints: 25,
      createdAt: serverTimestamp()
    }
  );

  await addPoints(
    currentUser.uid,
    5,
    "Offered a useful skill"
  );

  event.target.reset();

  $("helpFormWrap")
    .classList.add("hidden");

  toast("🤝 Help added! +5 community points");

  await loadAll();
};


/* ---------- Society Head ---------- */

$("newPollBtn").onclick = () => {
  $("pollFormWrap")
    .classList.toggle("hidden");
};


$("cancelPoll").onclick = () => {
  $("pollFormWrap")
    .classList.add("hidden");
};


$("pollForm").onsubmit = async event => {
  event.preventDefault();

  if (!isHead()) {
    toast("Society Head access only");
    return;
  }

  const options =
    $("pollOptions")
      .value
      .split(",")
      .map(value => value.trim())
      .filter(Boolean)
      .map(text => ({
        text,
        votes: 0
      }));

  if (options.length < 2) {
    toast("Add at least two options");
    return;
  }

  await addDoc(
    collection(db, "polls"),
    {
      question:
        $("pollQuestion").value.trim(),
      options,
      closed: false,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    }
  );

  event.target.reset();

  $("pollFormWrap")
    .classList.add("hidden");

  toast("Poll created");

  await loadAll();
};


$("newEventBtn").onclick = () => {
  $("eventFormWrap")
    .classList.toggle("hidden");
};


$("cancelEvent").onclick = () => {
  $("eventFormWrap")
    .classList.add("hidden");
};


$("eventForm").onsubmit = async event => {
  event.preventDefault();

  if (!isHead()) {
    toast("Society Head access only");
    return;
  }

  await addDoc(
    collection(db, "events"),
    {
      title:
        $("eventTitle").value.trim(),
      date: $("eventDate").value,
      location:
        $("eventLocation").value.trim(),
      description:
        $("eventDescription").value.trim(),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    }
  );

  event.target.reset();

  $("eventFormWrap")
    .classList.add("hidden");

  toast("Event added");

  await loadAll();
};


/* ---------- Dashboard ---------- */

function renderDashboard() {
  if (!isHead()) {
    $("dashboardList").innerHTML = `
      <div class="card">
        <h3>Society Head access only</h3>
        <p class="muted">
          Sign in with the configured society head account.
        </p>
      </div>
    `;

    return;
  }

  $("dashboardList").innerHTML = `
    <div class="card">
      <h3>🚨 Emergency Alerts</h3>
      <p>
        Active:
        <strong>
          ${
            cache.emergencies.filter(
              emergency =>
                emergency.status !== "Resolved"
            ).length
          }
        </strong>
      </p>
    </div>

    ${cache.emergencies.map(emergency => `
      <article class="card emergency-card">
        <span class="tag">
          ${escapeHTML(emergency.type)}
        </span>

        <h3>
          ${escapeHTML(emergency.location)}
        </h3>

        <p>
          ${escapeHTML(emergency.description)}
        </p>

        <p class="muted">
          ${escapeHTML(
            emergency.createdByName ||
            "Resident"
          )}
          · ${fmt(emergency.createdAt)}
        </p>

        <p>
          Status:
          <strong>
            ${escapeHTML(
              emergency.status || "Active"
            )}
          </strong>
        </p>
      </article>
    `).join("")}

    ${cache.problems.map(problem => `
      <article class="card">
        <span class="tag">
          ${escapeHTML(
            problem.category || "Other"
          )}
        </span>

        <h3>
          ${escapeHTML(problem.title)}
        </h3>

        <p>
          ${escapeHTML(
            problem.description
          )}
        </p>

        <p class="muted">
          ${
            problem.anonymous
              ? "Anonymous"
              : escapeHTML(
                  problem.authorName ||
                  "Resident"
                )
          }
          · ${fmt(problem.createdAt)}
        </p>

        <select
          class="statusSelect"
          data-status-id="${problem.id}">

          <option ${
            problem.status === "Open"
              ? "selected"
              : ""
          }>
            Open
          </option>

          <option ${
            problem.status === "In Progress"
              ? "selected"
              : ""
          }>
            In Progress
          </option>

          <option ${
            problem.status === "Resolved"
              ? "selected"
              : ""
          }>
            Resolved
          </option>
        </select>
      </article>
    `).join("")}
  `;

  document.querySelectorAll(
    "[data-status-id]"
  ).forEach(select => {
    select.onchange = async () => {
      await updateDoc(
        doc(
          db,
          "problems",
          select.dataset.statusId
        ),
        {
          status: select.value,
          updatedAt: serverTimestamp()
        }
      );

      toast("Problem status updated");

      await loadAll();
    };
  });
}
