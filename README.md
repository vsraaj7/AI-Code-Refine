# AI Code Refine

I built this during the NASSCOM Generative AI Hackathon. The idea was simple — paste your code, get back a full review with bugs flagged, a fixed version, and an explanation of what went wrong and why. No accounts, no IDE plugins, just a web page that does the work.

It uses the Groq API under the hood with LLaMA 3.3 70B, which is fast enough that the whole review usually comes back in a few seconds.

---

## What it does

You paste code (or drop a file), pick a language and review mode, hit the button, and it gives you:

- a quality score from 0 to 100 with a grade
- a list of issues sorted by severity — critical, warning, or info
- your original code next to the fixed version
- a plain-English explanation of every change
- improvement suggestions and test case ideas

There are three review modes. Deep review is the default and covers everything — bugs, code smells, performance, maintainability. Quick review is a fast pass for obvious critical errors only. Security audit focuses entirely on vulnerabilities, injection risks, and insecure patterns.

---

## Languages supported

Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, PHP, Ruby, Swift, Kotlin, SQL, and Bash.

---

```bash
python3 app.py
```

Open `http://localhost:5001` in your browser and you're good to go.

---

## Project structure

```
ai-code-refine/
├── app.py              # Flask backend, Groq API calls, rate limiting
├── requirements.txt
├── .env
├── templates/
│   └── index.html
└── static/
    ├── style.css       # layout and components
    ├── effects.css     # dark theme, cursor, particle canvas, animations
    └── script.js       # all the frontend logic + visual effects
```

---

## A few things worth knowing

The backend rate limits to 10 requests per minute per IP so it doesn't blow through the free tier. You can change `RATE_LIMIT` and `RATE_WINDOW` in `app.py` if you need more headroom.

The UI has a custom cursor, an animated particle canvas in the background, and a multi-ring loader while the review is running. All of that lives in `effects.css` and the bottom of `script.js` — easy to strip out if you want a lighter version.

Review history is saved in `localStorage` so your last 20 reviews stick around between sessions. Nothing is stored server-side.

---

## Stack

- **Backend** — Python, Flask
- **AI** — Groq API, llama-3.3-70b-versatile
- **Frontend** — plain HTML, CSS, vanilla JS
- **Syntax highlighting** — highlight.js

---

## License

MIT. Use it however you want.

---