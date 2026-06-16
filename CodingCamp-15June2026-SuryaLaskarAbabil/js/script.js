// ================= DARK MODE =================

const themeBtn = document.getElementById("themeBtn");

function applyTheme(dark) {
    if (dark) {
        document.body.classList.add("dark");
        themeBtn.textContent = "☀️";
    } else {
        document.body.classList.remove("dark");
        themeBtn.textContent = "🌙";
    }
}

// Load saved theme preference
let isDark = localStorage.getItem("dark") === "true";
applyTheme(isDark);

themeBtn.onclick = () => {
    isDark = !isDark;
    localStorage.setItem("dark", isDark);
    applyTheme(isDark);
};


// ================= CLOCK =================

function updateClock() {

    const now = new Date();

    document.getElementById("clock").innerHTML =
        now.toLocaleTimeString();

    document.getElementById("date").innerHTML =
        now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });

    const hour = now.getHours();

    let greeting = "Good Evening";

    if (hour < 12)
        greeting = "Good Morning";
    else if (hour < 17)
        greeting = "Good Afternoon";

    document.getElementById("greeting").innerHTML = greeting;

}

setInterval(updateClock, 1000);
updateClock();


// ================= TIMER =================

// Load saved pomodoro duration (default 25 minutes)
let pomoDuration = parseInt(localStorage.getItem("pomoDuration") || "1500");
let time  = pomoDuration;
let timer;

const timerText   = document.getElementById("timer");
const customTime  = document.getElementById("customTime");
const setTimeBtn  = document.getElementById("setTimeBtn");

// Pre-fill the input with the saved duration in minutes
customTime.value = pomoDuration / 60;

function updateTimer() {

    let min = Math.floor(time / 60);
    let sec = time % 60;

    timerText.innerHTML =
        `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

}

updateTimer();

document.getElementById("startBtn").onclick = () => {

    clearInterval(timer);

    timer = setInterval(() => {

        if (time > 0) {
            time--;
            updateTimer();
        } else {
            clearInterval(timer);
        }

    }, 1000);

};

document.getElementById("stopBtn").onclick = () => {
    clearInterval(timer);
};

document.getElementById("resetBtn").onclick = () => {
    clearInterval(timer);
    time = pomoDuration;
    updateTimer();
};

// Set custom pomodoro time
setTimeBtn.onclick = () => {

    const mins = parseInt(customTime.value);

    if (isNaN(mins) || mins < 1 || mins > 120) return;

    clearInterval(timer);

    pomoDuration = mins * 60;
    time         = pomoDuration;

    localStorage.setItem("pomoDuration", pomoDuration);

    updateTimer();

};


// ================= TASK =================

const taskInput        = document.getElementById("taskInput");
const taskList         = document.getElementById("taskList");
const duplicateWarning = document.getElementById("duplicateWarning");

// Load tasks from LocalStorage
function loadTasks() {

    const tasks = JSON.parse(localStorage.getItem("tasks") || "[]");

    tasks.forEach(task => renderTask(task.text, task.done));

}

// Save all current tasks to LocalStorage
function saveTasks() {

    const tasks = [];

    taskList.querySelectorAll(".task").forEach(div => {

        const checkbox = div.querySelector("input[type='checkbox']");
        const span     = div.querySelector("span");

        tasks.push({ text: span.textContent, done: checkbox.checked });

    });

    localStorage.setItem("tasks", JSON.stringify(tasks));

}

// Check if a task already exists (case-insensitive)
function isDuplicateTask(text) {

    let found = false;

    taskList.querySelectorAll(".task span").forEach(span => {
        if (span.textContent.toLowerCase() === text.toLowerCase()) {
            found = true;
        }
    });

    return found;

}

// Create and append a task element
function renderTask(text, done = false) {

    const div = document.createElement("div");
    div.className = "task";

    div.innerHTML = `
        <label class="flex items-center gap-2">
            <input type="checkbox" ${done ? "checked" : ""}>
            <span class="${done ? "line-through text-gray-400" : ""}">${text}</span>
        </label>
        <button class="deleteBtn">Delete</button>
    `;

    const checkbox = div.querySelector("input[type='checkbox']");
    const span     = div.querySelector("span");

    checkbox.onchange = () => {
        span.className = checkbox.checked ? "line-through text-gray-400" : "";
        saveTasks();
    };

    div.querySelector("button").onclick = () => {
        div.remove();
        saveTasks();
    };

    taskList.appendChild(div);

}

document.getElementById("addTask").onclick = () => {

    const text = taskInput.value.trim();

    if (text === "") return;

    // Prevent duplicate tasks
    if (isDuplicateTask(text)) {
        duplicateWarning.style.display = "block";
        setTimeout(() => { duplicateWarning.style.display = "none"; }, 2500);
        return;
    }

    duplicateWarning.style.display = "none";

    renderTask(text);
    saveTasks();

    taskInput.value = "";

};

// Also allow pressing Enter to add task
taskInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("addTask").click();
});

loadTasks();


// ================= LINKS =================

const linksContainer = document.getElementById("links");

// Load links from LocalStorage
function loadLinks() {

    const links = JSON.parse(localStorage.getItem("links") || "[]");

    links.forEach(link => renderLink(link.name, link.url));

}

// Save all current links to LocalStorage
function saveLinks() {

    const links = [];

    linksContainer.querySelectorAll(".link-wrapper a").forEach(a => {
        links.push({ name: a.textContent, url: a.getAttribute("href") });
    });

    localStorage.setItem("links", JSON.stringify(links));

}

// Create and append a link element
function renderLink(name, url) {

    const wrapper = document.createElement("div");
    wrapper.className = "link-wrapper";

    const a = document.createElement("a");
    a.className   = "link";
    a.href        = url;
    a.target      = "_blank";
    a.textContent = name;

    const delBtn = document.createElement("button");
    delBtn.className   = "link-delete";
    delBtn.textContent = "✕";
    delBtn.title       = "Remove link";

    delBtn.onclick = () => {
        wrapper.remove();
        saveLinks();
    };

    wrapper.appendChild(a);
    wrapper.appendChild(delBtn);
    linksContainer.appendChild(wrapper);

}

document.getElementById("addLink").onclick = () => {

    const name = document.getElementById("linkName").value.trim();
    const url  = document.getElementById("linkUrl").value.trim();

    if (name === "" || url === "") return;

    renderLink(name, url);
    saveLinks();

    document.getElementById("linkName").value = "";
    document.getElementById("linkUrl").value  = "";

};

loadLinks();
