import io
import os

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from flask import Flask, jsonify, render_template_string, request, send_file
from flask_cors import CORS
from google import genai
from PIL import Image


load_dotenv()

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
ELEVEN_KEY = os.environ.get("ELEVENLABS_API_KEY")
VOICE_ID = os.environ.get("VOICE_ID")

if not GEMINI_KEY or not ELEVEN_KEY or not VOICE_ID:
    raise ValueError("Missing GEMINI_API_KEY, ELEVENLABS_API_KEY, or VOICE_ID in .env.")

gemini_client = genai.Client(api_key=GEMINI_KEY)
eleven_client = ElevenLabs(api_key=ELEVEN_KEY)

app = Flask(__name__)
CORS(app)

latest_audio_cache = b""

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/")
def home():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return render_template_string(f.read())
    except Exception as e:
        return f"Error loading index.html: {str(e)}", 500

@app.route("/get_audio", methods=["GET"])
def get_audio():
    global latest_audio_cache
    if not latest_audio_cache:
        return "No audio generated yet", 404
    return send_file(
        io.BytesIO(latest_audio_cache),
        mimetype="audio/mpeg",
        as_attachment=False,
        download_name="wand_output.mp3"
    )

@app.route("/analyze", methods=["POST"])
def analyze_image():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    try:
        print("Browser snapshot received. Sending image to Gemini...")

        image_bytes = request.files["image"].read()
        pil_image = Image.open(io.BytesIO(image_bytes))

        prompt = (
            "You are a helpful, empathetic assistant for a visually impaired user. "
            "Analyze this image taken from their device's camera. Describe exactly what is "
            "directly in front of them in 2 short, concise sentences. Focus purely on immediate utility, "
            "reading any visible text, or pointing out physical obstructions."
        )

        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[pil_image, prompt],
        )
        description_text = response.text or "No identifiable objects detected."
        print(f"Gemini analysis: {description_text}")

        audio_stream = eleven_client.text_to_speech.convert(
            text=description_text,
            voice_id=VOICE_ID,
            model_id="eleven_flash_v2_5",
            output_format="mp3_44100_128",
        )

        audio_bytes = b"".join(audio_stream)
        print("Audio completed. Streaming MP3 to browser...")

        return send_file(
            io.BytesIO(audio_bytes),
            mimetype="audio/mpeg",
            as_attachment=False,
            download_name="wand_output.mp3",
        )

    except Exception as e:
        print(f"Error inside pipeline: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
