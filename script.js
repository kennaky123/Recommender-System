const courses = [
  {
    id: 1,
    title: "HTML cơ bản",
    topic: "frontend",
    level: 1,
    duration: 2,
    tags: ["html", "frontend", "web", "basic"],
    prerequisites: [],
    description: "Học cấu trúc trang web bằng HTML.",
  },
  {
    id: 2,
    title: "CSS Flexbox và Grid",
    topic: "frontend",
    level: 2,
    duration: 3,
    tags: ["css", "frontend", "layout", "flexbox", "grid"],
    prerequisites: ["html"],
    description: "Học cách chia layout bằng Flexbox và Grid.",
  },
  {
    id: 3,
    title: "JavaScript cơ bản",
    topic: "frontend",
    level: 2,
    duration: 4,
    tags: ["javascript", "frontend", "logic", "dom"],
    prerequisites: ["html", "css"],
    description: "Học biến, hàm, điều kiện, vòng lặp và DOM.",
  },
  {
    id: 4,
    title: "React cơ bản",
    topic: "frontend",
    level: 3,
    duration: 5,
    tags: ["react", "frontend", "component", "jsx"],
    prerequisites: ["javascript"],
    description: "Xây dựng giao diện bằng component React.",
  },
  {
    id: 5,
    title: "SQL cơ bản",
    topic: "database",
    level: 2,
    duration: 3,
    tags: ["sql", "database", "query"],
    prerequisites: [],
    description: "Học SELECT, INSERT, UPDATE, DELETE.",
  },
  {
    id: 6,
    title: "Thiết kế cơ sở dữ liệu",
    topic: "database",
    level: 3,
    duration: 4,
    tags: ["database", "erd", "normalization", "sql"],
    prerequisites: ["sql"],
    description: "Học ERD, khóa chính, khóa ngoại và chuẩn hóa dữ liệu.",
  },
  {
    id: 7,
    title: "Node.js cơ bản",
    topic: "backend",
    level: 2,
    duration: 4,
    tags: ["nodejs", "backend", "javascript", "server"],
    prerequisites: ["javascript"],
    description: "Học cách xây dựng server bằng Node.js.",
  },
  {
    id: 8,
    title: "Express.js API",
    topic: "backend",
    level: 3,
    duration: 5,
    tags: ["express", "nodejs", "backend", "api"],
    prerequisites: ["nodejs"],
    description: "Xây dựng REST API bằng Express.js.",
  },
  {
    id: 9,
    title: "Git và GitHub",
    topic: "tool",
    level: 1,
    duration: 2,
    tags: ["git", "github", "tool"],
    prerequisites: [],
    description: "Quản lý source code bằng Git và GitHub.",
  },
  {
    id: 10,
    title: "Dự án Fullstack mini",
    topic: "project",
    level: 4,
    duration: 8,
    tags: ["project", "frontend", "backend", "database"],
    prerequisites: ["html", "css", "javascript", "nodejs", "sql"],
    description: "Làm một web app mini có frontend, backend và database.",
  },
];

function convertInputToArray(value) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== "");
}

function jaccardSimilarity(arrayA, arrayB) {
  const setA = new Set(arrayA);
  const setB = new Set(arrayB);

  const intersection = [...setA].filter((item) => setB.has(item));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.length / union.size;
}

function getPrerequisiteScore(course, knownSkills) {
  if (course.prerequisites.length === 0) {
    return 1;
  }

  const completed = course.prerequisites.filter((skill) =>
    knownSkills.includes(skill),
  );

  return completed.length / course.prerequisites.length;
}

function getLevelScore(courseLevel, userLevel) {
  const diff = Math.abs(courseLevel - userLevel);

  if (diff === 0) return 1;
  if (diff === 1) return 0.75;
  if (diff === 2) return 0.4;

  return 0.1;
}

function getTimeScore(courseDuration, hoursPerDay) {
  if (courseDuration <= hoursPerDay) return 1;
  if (courseDuration <= hoursPerDay + 2) return 0.7;

  return 0.3;
}

function recommendStudyPlan(userProfile) {
  const userKeywords = [
    userProfile.goal,
    ...userProfile.knownSkills,
    ...userProfile.weakSkills,
  ];

  const recommendations = courses.map((course) => {
    const contentScore = jaccardSimilarity(userKeywords, course.tags);
    const prerequisiteScore = getPrerequisiteScore(
      course,
      userProfile.knownSkills,
    );
    const levelScore = getLevelScore(course.level, userProfile.level);
    const timeScore = getTimeScore(course.duration, userProfile.hoursPerDay);

    const weakMatch = course.tags.some((tag) =>
      userProfile.weakSkills.includes(tag),
    );

    const weakSkillScore = weakMatch ? 1 : 0.3;

    const finalScore =
      contentScore * 0.3 +
      prerequisiteScore * 0.25 +
      levelScore * 0.2 +
      timeScore * 0.15 +
      weakSkillScore * 0.1;

    const reasons = [];

    if (contentScore > 0) {
      reasons.push("Phù hợp với mục tiêu hoặc kỹ năng bạn nhập.");
    }

    if (prerequisiteScore === 1) {
      reasons.push("Bạn đã đủ kiến thức nền để học.");
    } else {
      reasons.push("Bạn còn thiếu một số kiến thức nền.");
    }

    if (weakMatch) {
      reasons.push("Khóa học này giúp cải thiện kỹ năng còn yếu.");
    }

    if (timeScore >= 0.7) {
      reasons.push("Phù hợp với thời gian học mỗi ngày.");
    }

    return {
      course,
      score: finalScore.toFixed(3),
      reasons,
    };
  });

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
}

function handleRecommend() {
  const goal = document.getElementById("goal").value;
  const level = Number(document.getElementById("level").value);
  const hoursPerDay = Number(document.getElementById("hoursPerDay").value);

  const knownSkills = convertInputToArray(
    document.getElementById("knownSkills").value,
  );

  const weakSkills = convertInputToArray(
    document.getElementById("weakSkills").value,
  );

  const userProfile = {
    goal,
    level,
    hoursPerDay,
    knownSkills,
    weakSkills,
  };

  const recommendations = recommendStudyPlan(userProfile);

  displayRecommendations(recommendations);
}

function displayRecommendations(recommendations) {
  const resultDiv = document.getElementById("result");

  let html = "<h2>Kết quả gợi ý</h2>";

  recommendations.forEach((item, index) => {
    const course = item.course;

    html += `
      <div class="card">
        <h3>${index + 1}. ${course.title}</h3>

        <p class="score">Điểm phù hợp: ${item.score}</p>

        <p>${course.description}</p>

        <p>
          <strong>Chủ đề:</strong> ${course.topic} |
          <strong>Level:</strong> ${course.level} |
          <strong>Thời lượng:</strong> ${course.duration} giờ
        </p>

        <p>
          ${course.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </p>

        <strong>Lý do gợi ý:</strong>
        <ul>
          ${item.reasons.map((reason) => `<li>${reason}</li>`).join("")}
        </ul>
      </div>
    `;
  });

  resultDiv.innerHTML = html;
}
