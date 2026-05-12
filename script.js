// ══════════════════════════════════
      //  CONFIG — set your backend URL here
      // ══════════════════════════════════
      const API = "https://serpent-backend.vercel.app/api";
      // During local dev, use:
      // const API = 'http://localhost:5000/api';

      // ══════════════════════════════════
      //  PARTICLES
      // ══════════════════════════════════
      (() => {
        const c = document.getElementById("particles");
        for (let i = 0; i < 30; i++) {
          const p = document.createElement("div");
          p.classList.add("particle");
          p.style.left = Math.random() * 100 + "%";
          p.style.width = p.style.height = 1 + Math.random() * 2.2 + "px";
          p.style.animationDuration = 9 + Math.random() * 13 + "s";
          p.style.animationDelay = Math.random() * 12 + "s";
          p.style.setProperty("--dx", (Math.random() - 0.5) * 100 + "px");
          c.appendChild(p);
        }
      })();

      // 3D preview
      (() => {
        const p = document.getElementById("snakePreview");
        [
          [0, 0],
          [0, 34],
          [0, 68],
          [0, 102],
          [0, 136],
          [32, 136],
          [64, 136],
        ].forEach(([t, l], i) => {
          const s = document.createElement("div");
          s.classList.add("sseg");
          s.style.top = t + "px";
          s.style.left = l + "px";
          s.style.opacity = 1 - i * 0.065;
          if (i === 0) s.style.filter = "brightness(1.35)";
          p.appendChild(s);
        });
      })();

      // ══════════════════════════════════
      //  OTP DIGIT INPUTS — auto-focus
      // ══════════════════════════════════
      function setupOTPInputs(containerSelector) {
        document
          .querySelectorAll(containerSelector + " .otp-digit")
          .forEach((inp) => {
            inp.addEventListener("input", (e) => {
              const val = e.target.value.replace(/\D/g, "");
              e.target.value = val.slice(-1);
              if (
                val &&
                inp.nextElementSibling?.classList.contains("otp-digit")
              )
                inp.nextElementSibling.focus();
            });
            inp.addEventListener("keydown", (e) => {
              if (
                e.key === "Backspace" &&
                !e.target.value &&
                inp.previousElementSibling?.classList.contains("otp-digit")
              )
                inp.previousElementSibling.focus();
              if (e.key === "Enter") handleOTPVerify();
            });
            inp.addEventListener("paste", (e) => {
              e.preventDefault();
              const text = (e.clipboardData || window.clipboardData)
                .getData("text")
                .replace(/\D/g, "")
                .slice(0, 6);
              const digits = document.querySelectorAll(
                containerSelector + " .otp-digit",
              );
              text.split("").forEach((ch, i) => {
                if (digits[i]) digits[i].value = ch;
              });
              const last = Math.min(text.length, 5);
              if (digits[last]) digits[last].focus();
            });
          });
      }
      setupOTPInputs("#step-otp");
      setupOTPInputs("#step-reset");

      function getOTPValue(group = "") {
        const sel = group
          ? `[data-group="${group}"]`
          : ".otp-digit:not([data-group])";
        return Array.from(document.querySelectorAll("#step-otp .otp-digit"))
          .map((i) => i.value)
          .join("");
      }
      function getResetOTPValue() {
        return Array.from(
          document.querySelectorAll("#reset-otp-inputs .otp-digit"),
        )
          .map((i) => i.value)
          .join("");
      }
      function clearOTPInputs(stepId) {
        document
          .querySelectorAll("#" + stepId + " .otp-digit")
          .forEach((i) => (i.value = ""));
      }

      // ══════════════════════════════════
      //  SCREEN & STEP MANAGEMENT
      // ══════════════════════════════════
      function showScreen(id) {
        document
          .querySelectorAll(".screen")
          .forEach((s) => s.classList.add("hidden"));
        document.getElementById(id).classList.remove("hidden");
      }

      function showAuthScreen(startStep = "login") {
        showScreen("auth-screen");
        showStep(startStep);
      }
      function closeAuth() {
        showScreen("landing-screen");
      }

      function showStep(step) {
        document
          .querySelectorAll(".auth-step")
          .forEach((s) => s.classList.add("hidden"));
        document.getElementById("step-" + step).classList.remove("hidden");
        clearAllErrors();
      }

      function clearAllErrors() {
        document.querySelectorAll(".api-error,.api-success").forEach((e) => {
          e.classList.remove("show");
          e.textContent = "";
        });
        document
          .querySelectorAll(".form-error")
          .forEach((e) => e.classList.remove("show"));
      }

      function showApiError(id, msg) {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.classList.add("show");
      }
      function showApiSuccess(id, msg) {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.classList.add("show");
      }

      function setLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled = loading;
        if (loading)
          btn.innerHTML = '<span class="spinner"></span>Processing...';
        else btn.innerHTML = btn.dataset.label || btn.innerHTML;
      }

      // ══════════════════════════════════
      //  API HELPER
      // ══════════════════════════════════
      async function apiPost(endpoint, body) {
        const res = await fetch(API + endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return { ok: res.ok, data };
      }

      async function apiGet(endpoint, token) {
        const res = await fetch(API + endpoint, {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await res.json();
        return { ok: res.ok, data };
      }

      // ══════════════════════════════════
      //  STATE
      // ══════════════════════════════════
      let currentUser = null; // {username, email, highScore, token, isGuest}
      let pendingEmail = ""; // email waiting for OTP
      let otpPurpose = ""; // 'login' | 'verify'
      let otpTimer = null;
      let otpSecondsLeft = 600;

      // ══════════════════════════════════
      //  AUTH FLOWS
      // ══════════════════════════════════

      // ── SIGNUP ──
      async function handleSignup() {
        clearAllErrors();
        const u = document.getElementById("su-username").value.trim();
        const e = document.getElementById("su-email").value.trim();
        const p = document.getElementById("su-pw").value;
        const c = document.getElementById("su-confirm").value;
        let ok = true;
        if (u.length < 3) {
          document.getElementById("su-user-err").classList.add("show");
          ok = false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          document.getElementById("su-email-err").classList.add("show");
          ok = false;
        }
        if (p.length < 6) {
          document.getElementById("su-pw-err").classList.add("show");
          ok = false;
        }
        if (p !== c) {
          document.getElementById("su-confirm-err").classList.add("show");
          ok = false;
        }
        if (!ok) return;

        document.getElementById("signup-btn").dataset.label =
          "→ Create Account";
        setLoading("signup-btn", true);
        const { ok: success, data } = await apiPost("/auth/signup", {
          username: u,
          email: e,
          password: p,
        });
        setLoading("signup-btn", false);

        if (!success) {
          showApiError("signup-err", data.message);
          return;
        }
        pendingEmail = e;
        otpPurpose = "verify";
        showOTPStep("Account OTP", "VERIFY YOUR EMAIL ADDRESS", e, "verify");
      }

      // ── LOGIN ──
      async function handleLogin() {
        clearAllErrors();
        const id = document.getElementById("login-id").value.trim();
        const pw = document.getElementById("login-pw").value;
        if (!id || !pw) {
          showApiError("login-err", "All fields are required");
          return;
        }

        document.getElementById("login-btn").dataset.label = "→ Send OTP";
        setLoading("login-btn", true);
        const { ok, data } = await apiPost("/auth/login", {
          emailOrUsername: id,
          password: pw,
        });
        setLoading("login-btn", false);

        if (!ok) {
          showApiError("login-err", data.message);
          return;
        }
        pendingEmail = data.email;
        otpPurpose = "login";
        showOTPStep(
          "Login OTP",
          "ENTER THE CODE FROM YOUR EMAIL",
          data.email,
          "login",
        );
      }

      // ── OTP STEP ──
      function showOTPStep(title, sub, email, purpose) {
        document.getElementById("otp-title").textContent = title;
        document.getElementById("otp-sub").textContent = sub;
        document.getElementById("otp-email-display").textContent = email;
        clearOTPInputs("step-otp");
        showStep("otp");
        startOTPCountdown();
        setTimeout(
          () => document.querySelector("#step-otp .otp-digit")?.focus(),
          100,
        );
      }

      function startOTPCountdown() {
        clearInterval(otpTimer);
        otpSecondsLeft = 600;
        const el = document.getElementById("otp-countdown");
        otpTimer = setInterval(() => {
          otpSecondsLeft--;
          const m = Math.floor(otpSecondsLeft / 60),
            s = otpSecondsLeft % 60;
          el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
          if (otpSecondsLeft <= 0) {
            clearInterval(otpTimer);
            el.textContent = "Expired";
          }
        }, 1000);
      }

      // ── VERIFY OTP ──
      async function handleOTPVerify() {
        clearAllErrors();
        const code = Array.from(
          document.querySelectorAll("#step-otp .otp-digit"),
        )
          .map((i) => i.value)
          .join("");
        if (code.length < 6) {
          showApiError("otp-err", "Enter the complete 6-digit code");
          return;
        }

        document.getElementById("otp-btn").dataset.label = "→ Verify";
        setLoading("otp-btn", true);

        let endpoint, body;
        if (otpPurpose === "login") {
          endpoint = "/auth/verify-login";
          body = { email: pendingEmail, otp: code };
        } else {
          endpoint = "/auth/verify-signup";
          body = { email: pendingEmail, otp: code };
        }

        const { ok, data } = await apiPost(endpoint, body);
        setLoading("otp-btn", false);

        if (!ok) {
          showApiError("otp-err", data.message);
          return;
        }
        clearInterval(otpTimer);
        showApiSuccess("otp-success", data.message);
        setTimeout(() => loginUser(data.user, data.token), 800);
      }

      // ── RESEND OTP ──
      async function handleResendOTP() {
        clearAllErrors();
        const { ok, data } = await apiPost("/auth/resend-otp", {
          email: pendingEmail,
          purpose: otpPurpose,
        });
        if (!ok) {
          showApiError("otp-err", data.message);
          return;
        }
        showApiSuccess("otp-success", "New OTP sent!");
        startOTPCountdown();
      }

      // ── FORGOT PASSWORD ──
      async function handleForgotPassword() {
        clearAllErrors();
        const email = document.getElementById("forgot-email").value.trim();
        if (!email) {
          showApiError("forgot-err", "Email is required");
          return;
        }

        document.getElementById("forgot-btn").dataset.label =
          "→ Send Reset OTP";
        setLoading("forgot-btn", true);
        const { ok, data } = await apiPost("/auth/forgot-password", { email });
        setLoading("forgot-btn", false);

        if (!ok) {
          showApiError("forgot-err", data.message);
          return;
        }
        pendingEmail = email;
        showApiSuccess("forgot-success", data.message);
        setTimeout(() => showStep("reset"), 1200);
      }

      // ── RESET PASSWORD ──
      async function handleResetPassword() {
        clearAllErrors();
        const code = getResetOTPValue();
        const pw = document.getElementById("reset-pw").value;
        const confirm = document.getElementById("reset-confirm").value;
        if (code.length < 6) {
          showApiError("reset-err", "Enter the complete 6-digit code");
          return;
        }
        if (pw.length < 6) {
          showApiError("reset-err", "Password must be 6+ characters");
          return;
        }
        if (pw !== confirm) {
          showApiError("reset-err", "Passwords do not match");
          return;
        }

        document.getElementById("reset-btn").dataset.label = "→ Reset Password";
        setLoading("reset-btn", true);
        const { ok, data } = await apiPost("/auth/reset-password", {
          email: pendingEmail,
          otp: code,
          newPassword: pw,
        });
        setLoading("reset-btn", false);

        if (!ok) {
          showApiError("reset-err", data.message);
          return;
        }
        showApiSuccess("reset-success", data.message);
        setTimeout(() => loginUser(data.user, data.token), 800);
      }

      // ── COMPLETE LOGIN ──
      function loginUser(user, token) {
        currentUser = { ...user, token, isGuest: false };
        localStorage.setItem("serpent_token", token);
        localStorage.setItem("serpent_user", JSON.stringify(user));
        startSession();
      }

      // ══════════════════════════════════
      //  CHECK EXISTING SESSION
      // ══════════════════════════════════
      async function checkSession() {
        const token = localStorage.getItem("serpent_token");
        if (!token) return;
        try {
          const { ok, data } = await apiGet("/game/profile", token);
          if (ok) {
            currentUser = { ...data, token, isGuest: false };
            showToast("Welcome back, " + data.username + "!");
            // Don't auto-start game, just update landing
          } else {
            localStorage.removeItem("serpent_token");
            localStorage.removeItem("serpent_user");
          }
        } catch (e) {}
      }

      // ══════════════════════════════════
      //  GUEST
      // ══════════════════════════════════
      const GUEST_SECS = 60; // 1 minute
      let guestLeft = GUEST_SECS,
        guestTid = null;

      function startAsGuest() {
        currentUser = {
          username: "Guest",
          isGuest: true,
          highScore: 0,
          token: null,
        };
        guestLeft = GUEST_SECS;
        startSession();
      }

      function startGuestCountdown() {
        const el = document.getElementById("guest-timer");
        el.classList.remove("hidden");
        el.textContent = "01:00";
        clearInterval(guestTid);
        guestTid = setInterval(() => {
          guestLeft--;
          const m = Math.floor(guestLeft / 60),
            s = guestLeft % 60;
          el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
          if (guestLeft <= 15) el.classList.add("warning");
          if (guestLeft <= 0) {
            clearInterval(guestTid);
            stopGame();
            showScreen("expired-screen");
          }
        }, 1000);
      }

      // ══════════════════════════════════
      //  SESSION
      // ══════════════════════════════════
      function startSession() {
        showScreen("game-screen");
        document.getElementById("user-avatar").textContent =
          currentUser.username[0].toUpperCase();
        document.getElementById("user-name-display").textContent =
          currentUser.isGuest ? "Guest" : currentUser.username;
        document.getElementById("hud-highscore").textContent =
          currentUser.highScore || 0;
        setTimeout(initCanvas, 60);
        if (currentUser.isGuest) {
          startGuestCountdown();
        } else {
          document.getElementById("guest-timer").classList.add("hidden");
        }
      }

      function exitToMenu() {
        stopGame();
        clearInterval(guestTid);
        currentUser = null;
        showScreen("landing-screen");
      }

      // ══════════════════════════════════
      //  CANVAS GAME ENGINE
      // ══════════════════════════════════
      const CELL = 26;
      const SPEEDS = [220, 182, 150, 122, 100, 82, 66, 54];
      const SCORE_PER_LEVEL = 5;
      const DELTA = {
        right: { x: 1, y: 0 },
        left: { x: -1, y: 0 },
        down: { x: 0, y: 1 },
        up: { x: 0, y: -1 },
      };
      const OPP = { right: "left", left: "right", up: "down", down: "up" };

      let canvas, ctx, COLS, ROWS;
      let snake, snakePrev, dir, nextDir, food;
      let score, gameTime, level, stepMs;
      let isRunning = false,
        rafId = null,
        timerTid = null;
      let lastStepAt = 0,
        interp = 0;

      function initCanvas() {
        canvas = document.getElementById("gameCanvas");
        ctx = canvas.getContext("2d");
        const wrap = document.getElementById("boardWrap");
        const W = Math.min(window.innerWidth - 40, 1140);
        const H = Math.min(window.innerHeight - 150, 680);
        COLS = Math.floor(W / CELL);
        ROWS = Math.floor(H / CELL);
        canvas.width = COLS * CELL;
        canvas.height = ROWS * CELL;
        wrap.style.width = canvas.width + "px";
        wrap.style.height = canvas.height + "px";
        resetState();
        document.getElementById("startOverlay").classList.remove("hidden");
        document.getElementById("gameOverOverlay").classList.add("hidden");
        drawFrame(0);
      }

      function resetState() {
        const sx = Math.floor(COLS / 4) + 3,
          sy = Math.floor(ROWS / 2);
        snake = [
          { x: sx, y: sy },
          { x: sx - 1, y: sy },
          { x: sx - 2, y: sy },
          { x: sx - 3, y: sy },
        ];
        snakePrev = snake.map((s) => ({ ...s }));
        dir = "right";
        nextDir = "right";
        score = 0;
        gameTime = 0;
        level = 1;
        stepMs = SPEEDS[0];
        interp = 0;
        lastStepAt = 0;
        placeFood();
        syncHUD();
      }

      function placeFood() {
        let pos,
          tries = 0;
        do {
          pos = {
            x: Math.floor(Math.random() * COLS),
            y: Math.floor(Math.random() * ROWS),
          };
          tries++;
        } while (
          snake.some((s) => s.x === pos.x && s.y === pos.y) &&
          tries < 600
        );
        food = pos;
      }

      function startGame() {
        document.getElementById("startOverlay").classList.add("hidden");
        isRunning = true;
        lastStepAt = performance.now();
        timerTid = setInterval(() => {
          gameTime++;
          const m = Math.floor(gameTime / 60),
            s = gameTime % 60;
          document.getElementById("hud-time").textContent =
            `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        }, 1000);
        rafId = requestAnimationFrame(loop);
      }

      function stopGame() {
        isRunning = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        clearInterval(timerTid);
      }

      function loop(now) {
        if (!isRunning) return;
        const elapsed = now - lastStepAt;
        interp = Math.min(elapsed / stepMs, 1);
        if (elapsed >= stepMs) {
          lastStepAt = now;
          interp = 0;
          step();
          if (!isRunning) return;
        }
        drawFrame(interp);
        rafId = requestAnimationFrame(loop);
      }

      function step() {
        dir = nextDir;
        snakePrev = snake.map((s) => ({ ...s }));
        const d = DELTA[dir];
        const head = { x: snake[0].x + d.x, y: snake[0].y + d.y };
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
          gameOver();
          return;
        }
        if (snake.some((s) => s.x === head.x && s.y === head.y)) {
          gameOver();
          return;
        }
        const ate = head.x === food.x && head.y === food.y;
        snake.unshift(head);
        if (!ate) {
          snake.pop();
        } else {
          score++;
          placeFood();
          onScore();
        }
      }

      function drawFrame(t) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        drawFood();
        drawSnake(t);
      }

      function drawGrid() {
        ctx.strokeStyle = "rgba(0,255,136,0.045)";
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath();
          ctx.moveTo(x * CELL, 0);
          ctx.lineTo(x * CELL, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          ctx.beginPath();
          ctx.moveTo(0, y * CELL);
          ctx.lineTo(canvas.width, y * CELL);
          ctx.stroke();
        }
      }

      function drawFood() {
        const pulse = 0.82 + 0.18 * Math.sin(performance.now() * 0.0055);
        const cx = (food.x + 0.5) * CELL,
          cy = (food.y + 0.5) * CELL,
          r = CELL * 0.36 * pulse;
        const g1 = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 2.2);
        g1.addColorStop(0, "rgba(255,34,68,0.32)");
        g1.addColorStop(1, "rgba(255,34,68,0)");
        ctx.fillStyle = g1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        const g2 = ctx.createRadialGradient(
          cx - r * 0.28,
          cy - r * 0.28,
          0,
          cx,
          cy,
          r,
        );
        g2.addColorStop(0, "#ff7799");
        g2.addColorStop(0.6, "#ff2244");
        g2.addColorStop(1, "#99001a");
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      function lerp(a, b, t) {
        return a + (b - a) * t;
      }

      function drawSnake(t) {
        if (!snake.length) return;
        const pts = snake.map((seg, i) => {
          const prev = snakePrev[i] || snake[Math.min(i, snakePrev.length - 1)];
          return {
            wx: lerp(prev.x, seg.x, t) * CELL + CELL * 0.5,
            wy: lerp(prev.y, seg.y, t) * CELL + CELL * 0.5,
          };
        });

        const pl = (ctx, pts) => {
          ctx.beginPath();
          ctx.moveTo(pts[0].wx, pts[0].wy);
          pts.slice(1).forEach((p) => ctx.lineTo(p.wx, p.wy));
        };

        // Shadow
        ctx.save();
        ctx.strokeStyle = "rgba(0,180,80,.10)";
        ctx.lineWidth = CELL * 1.44 + 10;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        pl(ctx, pts);
        ctx.stroke();
        ctx.restore();
        // Body
        ctx.save();
        ctx.lineWidth = CELL * 1.44;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = "rgba(0,255,120,.55)";
        ctx.shadowBlur = 14;
        const bg = ctx.createLinearGradient(
          pts[0].wx,
          pts[0].wy,
          pts[pts.length - 1].wx,
          pts[pts.length - 1].wy,
        );
        bg.addColorStop(0, "#00ff88");
        bg.addColorStop(0.5, "#00dd66");
        bg.addColorStop(1, "#008844");
        ctx.strokeStyle = bg;
        pl(ctx, pts);
        ctx.stroke();
        ctx.restore();
        // Scale
        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,.14)";
        ctx.lineWidth = CELL * 1.44;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([CELL * 0.5, CELL * 0.5]);
        pl(ctx, pts);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Highlight
        ctx.save();
        ctx.strokeStyle = "rgba(180,255,215,.3)";
        ctx.lineWidth = CELL * 0.55;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        pl(ctx, pts);
        ctx.stroke();
        ctx.restore();

        // Head
        const hx = pts[0].wx,
          hy = pts[0].wy,
          hr = CELL * 0.44;
        ctx.save();
        ctx.shadowColor = "rgba(0,255,120,.9)";
        ctx.shadowBlur = 26;
        const hg = ctx.createRadialGradient(
          hx - hr * 0.22,
          hy - hr * 0.22,
          0,
          hx,
          hy,
          hr,
        );
        hg.addColorStop(0, "#afffcc");
        hg.addColorStop(0.4, "#00ff88");
        hg.addColorStop(1, "#00aa44");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const d = DELTA[dir];
        const px = -d.y,
          py = d.x;
        [
          [px, py],
          [-px, -py],
        ].forEach(([epx, epy]) => {
          const ex = hx + d.x * hr * 0.22 + epx * hr * 0.38,
            ey = hy + d.y * hr * 0.22 + epy * hr * 0.38;
          ctx.fillStyle = "rgba(230,255,240,.95)";
          ctx.beginPath();
          ctx.arc(ex, ey, hr * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#001508";
          ctx.beginPath();
          ctx.arc(ex + d.x * 1.8, ey + d.y * 1.8, hr * 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.75)";
          ctx.beginPath();
          ctx.arc(
            ex + d.x * 1.2 - 0.9,
            ey + d.y * 1.2 - 0.9,
            hr * 0.042,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        });

        // Tongue
        if (((performance.now() / 280) | 0) % 4 < 3) {
          const tx = hx + d.x * (hr + 5),
            ty = hy + d.y * (hr + 5);
          ctx.save();
          ctx.strokeStyle = "#ff1133";
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.shadowColor = "rgba(255,20,50,.7)";
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + d.x * 7, ty + d.y * 7);
          ctx.stroke();
          [
            [1, -1],
            [-1, 1],
          ].forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(tx + d.x * 7, ty + d.y * 7);
            ctx.lineTo(
              tx + d.x * 7 - d.y * 5 * sx + d.x * 5,
              ty + d.y * 7 + d.x * 5 * sy + d.y * 5,
            );
            ctx.stroke();
          });
          ctx.restore();
        }
      }

      // ── SCORE / LEVEL ──
      async function onScore() {
        const el = document.getElementById("hud-score");
        el.textContent = score;
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
        if (score >= (currentUser.highScore || 0)) {
          currentUser.highScore = score;
          document.getElementById("hud-highscore").textContent = score;
          if (!currentUser.isGuest && currentUser.token) {
            try {
              await apiPost("/game/score", { score });
            } catch (e) {}
          }
        }
        const nl = Math.min(
          Math.floor(score / SCORE_PER_LEVEL) + 1,
          SPEEDS.length,
        );
        if (nl > level) {
          level = nl;
          stepMs = SPEEDS[level - 1];
          const lf = document.getElementById("levelFlash");
          lf.classList.remove("show");
          void lf.offsetWidth;
          lf.classList.add("show");
          showToast("Level " + level + " — Speed up!");
          document.getElementById("hud-level").textContent = level;
          document.getElementById("speedFill").style.width =
            ((level - 1) / (SPEEDS.length - 1)) * 90 + 10 + "%";
        }
      }

      function syncHUD() {
        document.getElementById("hud-score").textContent = 0;
        document.getElementById("hud-highscore").textContent =
          currentUser?.highScore || 0;
        document.getElementById("hud-time").textContent = "00:00";
        document.getElementById("hud-level").textContent = 1;
        document.getElementById("speedFill").style.width = "10%";
      }

      function gameOver() {
        stopGame();
        document.getElementById("final-score").textContent = score;
        document.getElementById("final-best").textContent =
          currentUser.highScore;
        document.getElementById("gameOverOverlay").classList.remove("hidden");
      }

      function restartGame() {
        stopGame();
        document.getElementById("gameOverOverlay").classList.add("hidden");
        resetState();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFrame(0);
        startGame();
      }

      // ── INPUT ──
      function setDir(d) {
        if (!isRunning) return;
        if (d !== OPP[dir]) nextDir = d;
      }
      document.addEventListener("keydown", (e) => {
        const m = {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
        };
        if (m[e.key]) {
          e.preventDefault();
          setDir(m[e.key]);
        }
      });

      // ── TOAST ──
      let toastTid;
      function showToast(msg) {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(toastTid);
        toastTid = setTimeout(() => t.classList.remove("show"), 2400);
      }

      // ── RESIZE ──
      window.addEventListener("resize", () => {
        if (
          !document.getElementById("game-screen").classList.contains("hidden")
        ) {
          const was = isRunning;
          stopGame();
          initCanvas();
          if (was) startGame();
        }
      });

      // ── INIT ──
      checkSession();