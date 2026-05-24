from flask import Flask, request, jsonify, render_template, session
from groq import Groq
from dotenv import load_dotenv
import os
import json
import re
import time
from collections import defaultdict

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Simple in-memory rate limiter: {ip: [timestamps]}
rate_limit_store = defaultdict(list)
RATE_LIMIT = 10       # max requests
RATE_WINDOW = 60      # per 60 seconds


def check_rate_limit(ip):
    now = time.time()
    timestamps = rate_limit_store[ip]
    # Remove old timestamps outside the window
    rate_limit_store[ip] = [t for t in timestamps if now - t < RATE_WINDOW]
    if len(rate_limit_store[ip]) >= RATE_LIMIT:
        return False
    rate_limit_store[ip].append(now)
    return True


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    ip = request.remote_addr
    if not check_rate_limit(ip):
        return jsonify({"success": False, "error": "Rate limit exceeded. Please wait a moment."}), 429

    data = request.json
    code = data.get("code", "").strip()
    language = data.get("language", "Python")
    mode = data.get("mode", "deep")  # quick | deep | security

    if not code:
        return jsonify({"success": False, "error": "No code provided."}), 400

    if len(code) > 20000:
        return jsonify({"success": False, "error": "Code too long (max 20,000 characters)."}), 400

    mode_instructions = {
        "quick": "Do a quick review focusing only on obvious bugs and critical errors.",
        "deep": "Do a thorough deep review covering bugs, code smells, performance, best practices, and maintainability.",
        "security": "Focus exclusively on security vulnerabilities, injection risks, authentication issues, data exposure, and insecure patterns."
    }

    prompt = (
        f"You are an expert {language} code reviewer. {mode_instructions.get(mode, mode_instructions['deep'])}\n\n"
        "Return ONLY a raw JSON object — no markdown, no backticks, no text outside the JSON.\n\n"
        "Required JSON format:\n"
        "{\n"
        '  "score": <integer 0-100 representing overall code quality>,\n'
        '  "summary": "<one sentence summary of the code quality>",\n'
        '  "issues": [\n'
        '    {\n'
        '      "title": "<short issue title>",\n'
        '      "description": "<clear explanation of the problem>",\n'
        '      "severity": "<critical|warning|info>",\n'
        '      "category": "<bug|security|performance|style|maintainability>",\n'
        '      "line": <line number or null if not applicable>\n'
        '    }\n'
        "  ],\n"
        '  "fixedCode": "<the complete corrected code as a string>",\n'
        '  "explanation": "<friendly explanation of all changes made and why>",\n'
        '  "suggestions": ["<actionable improvement suggestion>"],\n'
        '  "testCases": ["<suggested test case description>"]\n'
        "}\n\n"
        "Severity guide: critical=crashes/security holes, warning=bad practice/potential bugs, info=style/minor improvements.\n"
        "Score guide: 0-40=poor, 41-60=fair, 61-80=good, 81-100=excellent.\n"
        "If no issues found, return empty issues array, score 90-100, and original code as fixedCode.\n\n"
        f"Code to review ({language}):\n{code}"
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        raw = response.choices[0].message.content
        # Strip markdown code fences if present
        clean = re.sub(r"```(?:json)?|```", "", raw).strip()
        # Extract JSON object if there's surrounding text
        json_match = re.search(r'\{[\s\S]*\}', clean)
        if json_match:
            clean = json_match.group(0)
        result = json.loads(clean)

        # Ensure required fields exist with defaults
        result.setdefault("score", 50)
        result.setdefault("summary", "Review complete.")
        result.setdefault("issues", [])
        result.setdefault("fixedCode", code)
        result.setdefault("explanation", "No explanation provided.")
        result.setdefault("suggestions", [])
        result.setdefault("testCases", [])

        # Clamp score
        result["score"] = max(0, min(100, int(result["score"])))

        return jsonify({"success": True, "result": result})

    except json.JSONDecodeError as e:
        return jsonify({"success": False, "error": f"Failed to parse AI response: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/history", methods=["GET"])
def get_history():
    history = session.get("history", [])
    return jsonify({"success": True, "history": history})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
