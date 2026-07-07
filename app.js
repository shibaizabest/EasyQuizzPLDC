"use strict";

const app = document.querySelector("#app");

// Toàn bộ trạng thái của phiên làm quiz chỉ nằm trong bộ nhớ JavaScript.
const state = {
  quizIndex: [],
  meta: null,
  quizTitle: "",
  originalQuestions: [],
  questions: [],
  answers: [],
  revealedAnswers: [],
  currentQuestion: 0,
  shuffleEnabled: false,
  instantFeedbackEnabled: false,
  isReviewMode: false,
  lastResult: null,
  homeSearch: "",
  homePage: 1,
  homePageSize: 20,
  questionDirection: 1
};

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("keydown", handleQuizKeyboardNavigation);
window.addEventListener("hashchange", handleRoute);

function handleQuizKeyboardNavigation(event) {
  if (
    !["ArrowLeft", "ArrowRight"].includes(event.key)
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
    || event.repeat
  ) return;

  const buttonId = event.key === "ArrowLeft" ? "#previous-question" : "#next-question";
  const navigationButton = document.querySelector(buttonId);
  if (!navigationButton || navigationButton.disabled) return;

  event.preventDefault();
  navigationButton.click();
}

async function init() {
  try {
    await loadQuizIndex();
    await handleRoute();
  } catch (error) {
    renderError(error.message);
  }
}

/** Tải danh sách quiz từ file JSON tĩnh. */
async function loadQuizIndex() {
  let response;
  try {
    response = await fetch("data/index.json", { cache: "no-cache" });
  } catch (_error) {
    throw new Error("Không thể kết nối để tải data/index.json. Hãy chạy web bằng local server (ví dụ Live Server), không mở trực tiếp bằng file://.");
  }

  if (!response.ok) {
    throw new Error(`Không tải được data/index.json (HTTP ${response.status}).`);
  }

  try {
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Dữ liệu gốc phải là một mảng.");
    state.quizIndex = data;
  } catch (error) {
    throw new Error(`data/index.json không phải JSON hợp lệ: ${error.message}`);
  }
}

/** Tải và parse một file .quiz trong thư mục data. */
async function loadQuiz(fileName) {
  let response;
  try {
    response = await fetch(`data/${encodeURIComponent(fileName)}`, { cache: "no-cache" });
  } catch (_error) {
    throw new Error(`Không thể tải file data/${fileName}. Hãy kiểm tra kết nối hoặc tên file.`);
  }

  if (!response.ok) {
    throw new Error(`Không tải được data/${fileName} (HTTP ${response.status}).`);
  }

  const text = await response.text();
  return parseQuiz(text);
}

/**
 * Chuyển nội dung text thành dữ liệu quiz.
 * Parser chuẩn hóa cả newline Windows và Unix, đồng thời báo rõ câu bị lỗi.
 */
function parseQuiz(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const allLines = normalized.split("\n");
  const titleLine = allLines.find((line) => line.trim().startsWith("# Quiz:"));

  if (!titleLine) {
    throw new Error('File quiz thiếu dòng tiêu đề "# Quiz:".');
  }

  const title = titleLine.trim().slice("# Quiz:".length).trim();
  if (!title) throw new Error('Tên quiz sau "# Quiz:" không được để trống.');

  const contentLines = allLines.filter((line) => line !== titleLine);
  const blocks = contentLines
    .join("\n")
    .split(/^\s*---\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) throw new Error("File quiz chưa có câu hỏi nào.");

  const questions = blocks.map((block, index) => parseQuestionBlock(block, index + 1));
  return { title, questions };
}

function parseQuestionBlock(block, questionNumber) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const questionLine = lines.find((line) => line.startsWith("Q:"));
  const answerLine = lines.find((line) => line.startsWith("ANSWER:"));
  const explainLine = lines.find((line) => line.startsWith("EXPLAIN:"));
  const errors = [];

  if (!questionLine || !questionLine.slice(2).trim()) errors.push('thiếu nội dung "Q:"');
  if (!answerLine) errors.push('thiếu dòng "ANSWER:"');

  const options = {};
  for (const letter of ["A", "B", "C", "D"]) {
    const prefix = `${letter}.`;
    const optionLine = lines.find((line) => line.startsWith(prefix));
    if (!optionLine || !optionLine.slice(prefix.length).trim()) {
      errors.push(`thiếu đáp án ${letter}.`);
    } else {
      options[letter] = optionLine.slice(prefix.length).trim();
    }
  }

  const correctAnswer = answerLine
    ? answerLine.slice("ANSWER:".length).trim().toUpperCase()
    : "";
  if (answerLine && !["A", "B", "C", "D"].includes(correctAnswer)) {
    errors.push('ANSWER phải là một trong các giá trị A, B, C hoặc D');
  }

  if (errors.length > 0) {
    throw new Error(`Lỗi format ở câu ${questionNumber}: ${errors.join("; ")}.`);
  }

  return {
    id: `q-${questionNumber}`,
    text: questionLine.slice(2).trim(),
    options,
    correctAnswer,
    explanation: explainLine
      ? explainLine.slice("EXPLAIN:".length).trim() || "Chưa có giải thích."
      : "Chưa có giải thích."
  };
}

async function handleRoute() {
  const hash = window.location.hash || "#/";
  const match = hash.match(/^#\/quiz\/([^/]+)$/);

  if (!match) {
    if (hash !== "#/" && hash !== "#") history.replaceState(null, "", "#/");
    renderHome();
    return;
  }

  const quizId = decodeURIComponent(match[1]);
  const meta = state.quizIndex.find((item) => item.id === quizId);
  if (!meta) {
    renderError(`Không tìm thấy quiz có mã "${quizId}".`, true);
    return;
  }

  renderLoading(`Đang tải ${meta.title}…`);
  try {
    const parsed = await loadQuiz(meta.file);
    state.meta = meta;
    state.quizTitle = parsed.title;
    state.originalQuestions = parsed.questions;
    state.questions = [];
    state.answers = [];
    state.isReviewMode = false;
    state.lastResult = null;
    renderQuizStart();
  } catch (error) {
    renderError(error.message, true);
  }
}

function renderHome() {
  app.innerHTML = `<section class="page-heading">
      <h1>Chọn bài để ôn tập</h1>
    </section>
    <section class="home-tools" aria-label="Tìm kiếm quiz">
      <label for="quiz-search">Tìm quiz theo tên</label>
      <div class="search-field">
        <span aria-hidden="true">⌕</span>
        <input
          id="quiz-search"
          type="search"
          placeholder="Ví dụ: Logic mệnh đề"
          value="${escapeHtml(state.homeSearch)}"
          autocomplete="off"
        >
      </div>
      <p id="search-summary" class="search-summary" aria-live="polite"></p>
    </section>
    <section id="quiz-list" class="quiz-grid" aria-label="Danh sách quiz"></section>
    <nav id="quiz-pagination" class="pagination" aria-label="Phân trang quiz"></nav>
    <aside class="donate-box">
      <p>Web miễn phí cho mọi người ôn tập. Nếu thấy hữu ích, bạn có thể ủng hộ mình để mình cập nhật thêm câu hỏi.</p>
      <div class="support-links">
        <a href="https://s.shopee.vn/5fmvWm9n5E" target="_blank" rel="sponsored noopener noreferrer">Link ủng hộ (Hoa hồng Shopee ấn vào một cái cho tôi là được, không cần mua =)) )</a>
        <a href="https://www.facebook.com/thinh.luuquang.33" target="_blank" rel="noopener noreferrer">Facebook của tôi</a>
      </div>
    </aside>`;

  const searchInput = document.querySelector("#quiz-search");
  searchInput.addEventListener("input", (event) => {
    state.homeSearch = event.target.value;
    state.homePage = 1;
    updateHomeResults();
  });

  updateHomeResults();
  focusApp();
}

/** Lọc danh sách và chỉ render tối đa 20 quiz cho trang hiện tại. */
function updateHomeResults() {
  const query = normalizeSearch(state.homeSearch);
  const filteredQuizzes = state.quizIndex.filter((quiz) =>
    normalizeSearch(quiz.title).includes(query)
  );
  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / state.homePageSize));
  state.homePage = Math.min(state.homePage, totalPages);

  const startIndex = (state.homePage - 1) * state.homePageSize;
  const pageQuizzes = filteredQuizzes.slice(startIndex, startIndex + state.homePageSize);
  const cards = pageQuizzes.map((quiz) => {
    const historyData = getQuizHistory(quiz.id);
    const historyHtml = historyData
      ? `<div class="history-row">
          <span>Điểm gần nhất: <strong>${historyData.latest.score}/${historyData.latest.total}</strong></span>
          <span>Điểm cao nhất: <strong>${historyData.best.score}/${historyData.best.total}</strong></span>
        </div>`
      : "";

    return `<article class="quiz-card">
      <h2>${escapeHtml(quiz.title)}</h2>
      ${quiz.description ? `<p>${escapeHtml(quiz.description)}</p>` : ""}
      <div class="quiz-meta">
        ${quiz.count ? `<span>${Number(quiz.count)} câu hỏi</span>` : ""}
        <span>Mã: ${escapeHtml(quiz.id)}</span>
      </div>
      ${historyHtml}
      <a class="button" href="#/quiz/${encodeURIComponent(quiz.id)}">Bắt đầu ôn</a>
    </article>`;
  }).join("");

  const emptyMessage = state.homeSearch.trim()
    ? `Không tìm thấy quiz nào có tên “${escapeHtml(state.homeSearch.trim())}”.`
    : "Chưa có quiz nào trong data/index.json.";
  document.querySelector("#quiz-list").innerHTML = cards
    || `<div class="status-card empty-state"><p>${emptyMessage}</p></div>`;

  const resultLabel = filteredQuizzes.length === 1 ? "1 quiz" : `${filteredQuizzes.length} quiz`;
  document.querySelector("#search-summary").textContent = query
    ? `Tìm thấy ${resultLabel}.`
    : `Có ${resultLabel} để ôn tập.`;

  renderPagination(totalPages, filteredQuizzes.length);
}

function renderPagination(totalPages, totalItems) {
  const pagination = document.querySelector("#quiz-pagination");
  if (totalItems <= state.homePageSize) {
    pagination.innerHTML = "";
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  pagination.innerHTML = `
    <button class="button secondary" id="previous-page" type="button" ${state.homePage === 1 ? "disabled" : ""}>Trang trước</button>
    <span>Trang <strong>${state.homePage}</strong> / ${totalPages}</span>
    <button class="button secondary" id="next-page" type="button" ${state.homePage === totalPages ? "disabled" : ""}>Trang sau</button>`;

  document.querySelector("#previous-page")?.addEventListener("click", () => changeHomePage(-1));
  document.querySelector("#next-page")?.addEventListener("click", () => changeHomePage(1));
}

function changeHomePage(offset) {
  state.homePage += offset;
  updateHomeResults();
  document.querySelector("#quiz-list").scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Tìm kiếm không phân biệt chữ hoa, chữ thường hay dấu tiếng Việt. */
function normalizeSearch(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function renderQuizStart() {
  app.innerHTML = `<section class="panel">
    <div class="page-heading">
      <h1>${escapeHtml(state.quizTitle)}</h1>
      <p>${escapeHtml(state.meta.description || "Sẵn sàng bắt đầu bài ôn tập.")}</p>
    </div>
    <div class="start-details"><strong>${state.originalQuestions.length} câu hỏi</strong> · Đáp án được lưu trong phiên làm bài này.</div>
    <div class="quiz-settings" aria-label="Tùy chọn làm bài">
      <label class="check-row">
        <input id="shuffle-questions" type="checkbox" ${state.shuffleEnabled ? "checked" : ""}>
        <span>Xáo trộn thứ tự câu hỏi</span>
      </label>
      <label class="check-row">
        <input id="instant-feedback" type="checkbox" ${state.instantFeedbackEnabled ? "checked" : ""}>
        <span>Hiện đáp án ngay sau khi chọn</span>
      </label>
    </div>
    <div class="button-row">
      <button class="button" id="start-quiz" type="button">Bắt đầu làm bài</button>
      <a class="button secondary" href="#/">Về trang chủ</a>
    </div>
  </section>`;

  document.querySelector("#start-quiz").addEventListener("click", () => {
    state.shuffleEnabled = document.querySelector("#shuffle-questions").checked;
    state.instantFeedbackEnabled = document.querySelector("#instant-feedback").checked;
    state.questions = state.shuffleEnabled
      ? shuffleArray(state.originalQuestions)
      : [...state.originalQuestions];
    state.answers = new Array(state.questions.length).fill(null);
    state.revealedAnswers = new Array(state.questions.length).fill(false);
    state.currentQuestion = 0;
    state.questionDirection = 1;
    state.isReviewMode = false;
    renderQuestion();
  });
  focusApp();
}

function renderQuestion() {
  const question = state.questions[state.currentQuestion];
  const selected = state.answers[state.currentQuestion];
  const isRevealed = state.revealedAnswers[state.currentQuestion] === true;
  const current = state.currentQuestion + 1;
  const total = state.questions.length;
  const optionsHtml = Object.entries(question.options).map(([letter, text]) => {
    const feedbackClass = isRevealed && letter === question.correctAnswer
      ? "correct-answer"
      : isRevealed && letter === selected
        ? "wrong-answer"
        : "";

    return `<label class="answer-option ${feedbackClass}">
      <input type="radio" name="answer" value="${letter}" ${selected === letter ? "checked" : ""} ${isRevealed ? "disabled" : ""}>
      <span><span class="answer-letter">${letter}.</span> ${escapeHtml(text)}</span>
    </label>`;
  }).join("");

  const instantFeedbackHtml = isRevealed
    ? renderInstantFeedback(question, selected)
    : "";

  const questionPickerHtml = state.questions.map((_item, index) => {
    const questionNumber = index + 1;
    const isAnswered = state.answers[index] !== null;
    const isCurrent = index === state.currentQuestion;
    const statusLabel = isAnswered ? "đã trả lời" : "chưa trả lời";

    return `<button
      class="question-picker-item ${isAnswered ? "is-answered" : "is-unanswered"} ${isCurrent ? "is-current" : ""}"
      type="button"
      data-question-index="${index}"
      aria-label="Đi đến câu ${questionNumber}, ${statusLabel}"
      ${isCurrent ? 'aria-current="step"' : ""}
    >${questionNumber}</button>`;
  }).join("");

  const directionClass = state.questionDirection < 0
    ? "is-previous"
    : state.questionDirection > 0
      ? "is-next"
      : "is-stay";
  app.innerHTML = `<div class="quiz-layout">
    <section class="question-card ${directionClass}">
      <div class="quiz-topbar">
        <strong>${state.isReviewMode ? "Ôn câu sai" : escapeHtml(state.quizTitle)}</strong>
        <span class="muted">Câu ${current}/${total}</span>
      </div>
      <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${current}" aria-label="Tiến độ làm bài">
        <div class="progress-bar" style="width: ${(current / total) * 100}%"></div>
      </div>
      <h2 class="question-text">${escapeHtml(question.text)}</h2>
      <fieldset class="answers" aria-label="Chọn một đáp án">${optionsHtml}</fieldset>
      ${instantFeedbackHtml}
      <nav class="question-nav" aria-label="Điều hướng câu hỏi">
        <button class="button secondary" id="previous-question" type="button" aria-label="Câu trước" title="Câu trước (phím mũi tên trái)" ${state.currentQuestion === 0 ? "disabled" : ""}>←</button>
        <div class="right-actions">
          ${current < total ? '<button class="button" id="next-question" type="button" aria-label="Câu sau" title="Câu sau (phím mũi tên phải)">→</button>' : ""}
          <button class="button danger" id="submit-quiz" type="button">Nộp bài</button>
        </div>
      </nav>
      <div class="button-row"><a class="button secondary" href="#/">Về trang chủ</a></div>
    </section>
    <aside class="question-picker" aria-labelledby="question-picker-title">
      <div class="question-picker-heading">
        <h3 id="question-picker-title">Chọn câu hỏi</h3>
        <div class="question-picker-legend" aria-hidden="true">
          <span><i class="legend-dot answered"></i>Đã trả lời</span>
          <span><i class="legend-dot unanswered"></i>Chưa trả lời</span>
        </div>
      </div>
      <div class="question-picker-grid">${questionPickerHtml}</div>
    </aside>
  </div>`;

  document.querySelectorAll('input[name="answer"]').forEach((input) => {
    input.addEventListener("change", (event) => {
      state.answers[state.currentQuestion] = event.target.value;
      if (state.instantFeedbackEnabled) {
        state.revealedAnswers[state.currentQuestion] = true;
        state.questionDirection = 0;
        renderQuestion();
      } else {
        markCurrentQuestionAnswered();
      }
    });
  });
  document.querySelectorAll("[data-question-index]").forEach((button) => {
    button.addEventListener("click", () => goToQuestion(Number(button.dataset.questionIndex)));
  });
  document.querySelector("#previous-question")?.addEventListener("click", () => moveQuestion(-1));
  document.querySelector("#next-question")?.addEventListener("click", () => moveQuestion(1));
  document.querySelector("#submit-quiz").addEventListener("click", submitQuiz);

  if (state.questionDirection === 0) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector(".instant-feedback")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest"
    });
  } else {
    focusApp();
  }
}

function markCurrentQuestionAnswered() {
  const button = document.querySelector(`[data-question-index="${state.currentQuestion}"]`);
  if (!button) return;

  button.classList.remove("is-unanswered");
  button.classList.add("is-answered");
  button.setAttribute("aria-label", `Đi đến câu ${state.currentQuestion + 1}, đã trả lời`);
}

function goToQuestion(index) {
  if (index === state.currentQuestion || index < 0 || index >= state.questions.length) return;

  state.questionDirection = index > state.currentQuestion ? 1 : -1;
  state.currentQuestion = index;
  renderQuestion();
}

function renderInstantFeedback(question, selectedAnswer) {
  const isCorrect = selectedAnswer === question.correctAnswer;
  const correctText = `${question.correctAnswer}. ${question.options[question.correctAnswer]}`;

  return `<aside class="instant-feedback ${isCorrect ? "feedback-correct" : "feedback-incorrect"}" aria-live="polite">
    <strong>${isCorrect ? "Chính xác!" : "Chưa đúng."}</strong>
    ${isCorrect ? "" : `<p><strong>Đáp án đúng:</strong> ${escapeHtml(correctText)}</p>`}
    <p><strong>Giải thích:</strong> ${escapeHtml(question.explanation)}</p>
  </aside>`;
}

function moveQuestion(offset) {
  const next = state.currentQuestion + offset;
  if (next >= 0 && next < state.questions.length) {
    state.questionDirection = offset;
    state.currentQuestion = next;
    renderQuestion();
  }
}

function submitQuiz() {
  const unanswered = state.answers.filter((answer) => answer === null).length;
  if (unanswered > 0) {
    const shouldSubmit = window.confirm(`Bạn còn ${unanswered} câu chưa chọn đáp án. Bạn vẫn muốn nộp bài?`);
    if (!shouldSubmit) return;
  }

  const details = state.questions.map((question, index) => ({
    question,
    selectedAnswer: state.answers[index],
    isCorrect: state.answers[index] === question.correctAnswer
  }));
  const score = details.filter((item) => item.isCorrect).length;
  const total = details.length;
  const percent = Math.round((score / total) * 100);

  state.lastResult = { score, total, percent, details };
  // Lần ôn riêng câu sai không ghi đè thành tích của bài quiz đầy đủ.
  if (!state.isReviewMode) saveQuizHistory(state.meta.id, score, total, percent);
  renderResult();
}

function renderResult() {
  const { score, total, percent, details } = state.lastResult;
  const comment = percent >= 80
    ? "Ổn áp, có thể luyện đề tổng hợp."
    : percent >= 50
      ? "Tạm ổn, nên ôn lại các câu sai."
      : "Nên học lại lý thuyết trước khi làm tiếp.";

  const resultItems = details.map((item, index) => {
    const selectedText = item.selectedAnswer
      ? `${item.selectedAnswer}. ${item.question.options[item.selectedAnswer]}`
      : "Chưa chọn đáp án";
    const correctText = `${item.question.correctAnswer}. ${item.question.options[item.question.correctAnswer]}`;

    return `<article class="result-item ${item.isCorrect ? "correct" : "incorrect"}">
      <h3>Câu ${index + 1}: ${escapeHtml(item.question.text)}</h3>
      <p class="result-status">${item.isCorrect ? "Đúng" : "Sai"}</p>
      <p><strong>Bạn chọn:</strong> ${escapeHtml(selectedText)}</p>
      <p><strong>Đáp án đúng:</strong> ${escapeHtml(correctText)}</p>
      <p class="explanation"><strong>Giải thích:</strong> ${escapeHtml(item.question.explanation)}</p>
    </article>`;
  }).join("");

  app.innerHTML = `<section class="result-card">
    <div class="page-heading">
      <h1>Kết quả${state.isReviewMode ? " ôn câu sai" : ""}</h1>
      <p>${escapeHtml(state.quizTitle)}</p>
    </div>
    <div class="score-block">
      <span class="score-number">${score}/${total}</span>
      <span class="score-percent">${percent}%</span>
      <p>${comment}</p>
    </div>
    <div class="button-row">
      <button class="button" id="retry-quiz" type="button">Làm lại quiz</button>
      <button class="button secondary" id="review-wrong" type="button">Ôn lại câu sai</button>
      <a class="button secondary" href="#/">Về trang chủ</a>
    </div>
    <section class="result-list" aria-label="Chi tiết kết quả">${resultItems}</section>
  </section>`;

  document.querySelector("#retry-quiz").addEventListener("click", renderQuizStart);
  document.querySelector("#review-wrong").addEventListener("click", startWrongAnswersReview);
  focusApp();
}

function startWrongAnswersReview() {
  const wrongQuestions = state.lastResult.details
    .filter((item) => !item.isCorrect)
    .map((item) => item.question);

  if (wrongQuestions.length === 0) {
    renderMessage("Bạn không có câu sai để ôn lại.", "Tuyệt vời!", true);
    return;
  }

  state.questions = [...wrongQuestions];
  state.answers = new Array(wrongQuestions.length).fill(null);
  state.revealedAnswers = new Array(wrongQuestions.length).fill(false);
  state.currentQuestion = 0;
  state.questionDirection = 1;
  state.isReviewMode = true;
  state.lastResult = null;
  renderQuestion();
}

function saveQuizHistory(quizId, score, total, percent) {
  const key = `easyQuiz.history.${quizId}`;
  const previous = getQuizHistory(quizId);
  const attempt = { score, total, percent, date: new Date().toISOString() };
  const best = !previous || percent > previous.best.percent ? attempt : previous.best;

  try {
    localStorage.setItem(key, JSON.stringify({ latest: attempt, best }));
  } catch (error) {
    console.warn("Không thể lưu lịch sử quiz vào localStorage:", error);
  }
}

function getQuizHistory(quizId) {
  try {
    const raw = localStorage.getItem(`easyQuiz.history.${quizId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.latest && parsed.best ? parsed : null;
  } catch (error) {
    console.warn("Không thể đọc lịch sử quiz:", error);
    return null;
  }
}

/** Trả về mảng mới đã xáo trộn theo thuật toán Fisher–Yates. */
function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function renderLoading(message) {
  app.innerHTML = `<section class="status-card" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <p>${escapeHtml(message)}</p>
  </section>`;
}

function renderError(message, showHomeButton = false) {
  app.innerHTML = `<section class="status-card error" role="alert">
    <h1>Không thể mở quiz</h1>
    <p>${escapeHtml(message)}</p>
    ${showHomeButton ? '<div class="button-row"><a class="button secondary" href="#/">Về trang chủ</a></div>' : ""}
  </section>`;
  focusApp();
}

function renderMessage(message, title = "Thông báo", showResultButton = false) {
  app.innerHTML = `<section class="status-card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="button-row">
      ${showResultButton ? '<button class="button" id="back-to-result" type="button">Xem lại kết quả</button>' : ""}
      <a class="button secondary" href="#/">Về trang chủ</a>
    </div>
  </section>`;
  document.querySelector("#back-to-result")?.addEventListener("click", renderResult);
  focusApp();
}

function focusApp() {
  window.scrollTo({ top: 0, behavior: "instant" });
  app.focus({ preventScroll: true });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
