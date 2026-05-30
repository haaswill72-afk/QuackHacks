import os
import io
import time
from flask import Flask, request, jsonify, send_file, render_template_string
from flask_cors import CORS
from dotenv import load_dotenv
from PIL import Image
from google import genai
from elevenlabs.client import ElevenLabs

# Load env variables from your hidden .env file
load_dotenv()

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
ELEVEN_KEY = os.environ.get("ELEVENLABS_API_KEY")

if not GEMINI_KEY or not ELEVEN_KEY:
    raise ValueError("❌ Missing API keys! Check your hidden .env file.")

app = Flask(__name__)
CORS(app)  # Enable browser security clearance

# Initialize your exact wand.py AI clients
gemini_client = genai.Client(api_key=GEMINI_KEY)
eleven_client = ElevenLabs(api_key=ELEVEN_KEY)

# HOME ROUTE: Serves your index.html file to the local network port
@app.route('/')
def home():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return render_template_string(html_content)
    except Exception as e:
        return f"Error loading index.html: {str(e)}", 500

@app.route('/analyze', methods=['POST'])
def analyze_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
        
    try:
        print("⚡ Browser snapshot received. Replicating wand.py pipeline...")
        
        # 1. Capture the frame chunk sent from the web dashboard
        image_file = request.files['image']
        image_bytes = image_file.read()
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # 2. ASK GEMINI WHAT IT SEES (Restored exactly from wand.py prompt logic)
        prompt = (
            "You are a helpful, empathetic assistant for a visually impaired user. "
            "Analyze this image taken from their device's camera. Describe exactly what is "
            "directly in front of them in 2 short, concise sentences. Focus purely on immediate utility, "
            "reading any visible text, or pointing out physical obstructions."
        )
        
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[pil_image, prompt]  # Matches wand.py syntax layout
        )
        
        description_text = response.text if response.text else "No identifiable objects detected."
        print(f"🤖 Gemini Analysis: \"{description_text}\"")
        
        # 3. GENERATE HUMAN SPEECH VIA ELEVENLABS (Restored exactly from wand.py)
        audio_stream = eleven_client.text_to_speech.convert(
            text=description_text,
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Premium default 'Rachel' voice ID
            model_id="eleven_flash_v2_5",    # Low-latency model
            output_format="mp3_44100_128"
        )
        
        # 4. SAVE AND STREAM THE AUDIO FILE WITH CACHE-BUSTING
        unique_id = int(time.time())
        output_filename = f"wand_output_{unique_id}.mp3"
        
        with open(output_filename, "wb") as f:
            for chunk in audio_stream:
                f.write(chunk)
                
        print(f"💾 Audio tracking completed. Streaming '{output_filename}' to browser components...")
        
        return send_file(
            output_filename, 
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name=output_filename
        )
        
    except Exception as e:
        print(f"❌ Error inside pipeline: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)