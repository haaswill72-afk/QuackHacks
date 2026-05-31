import os
import io
import time
import base64
import requests
from flask import Flask, request, jsonify, send_file, render_template_string
from flask_cors import CORS
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

# Load env variables from your hidden .env file
load_dotenv()

PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
ACCESS_TOKEN = os.environ.get("GCP_ACCESS_TOKEN")
ELEVEN_KEY = os.environ.get("ELEVENLABS_API_KEY")

if not PROJECT_ID or not ACCESS_TOKEN or not ELEVEN_KEY:
    raise ValueError("❌ Missing configurations in your .env file! Check your keys.")

eleven_client = ElevenLabs(api_key=ELEVEN_KEY)

app = Flask(__name__)
CORS(app)  # Enable browser security clearance

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
        print("⚡ Browser snapshot received. Routing directly via secure credit token...")
        
        # 1. Grab the uploaded image file and convert it to safe text bits
        image_file = request.files['image']
        image_bytes = image_file.read()
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
        prompt = (
            "You are a helpful, empathetic assistant for a visually impaired user. "
            "Analyze this image taken from their device's camera. Describe exactly what is "
            "directly in front of them in 2 short, concise sentences. Focus purely on immediate utility, "
            "reading any visible text, or pointing out physical obstructions."
        )
        
        # 2. Build the exact web URL for the Vertex AI engine (Indentation Fixed)
        url = f"https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"    
    
        # 3. Inject your access token as an explicit master security header
        headers = {
            "Authorization": f"BaseBearer {ACCESS_TOKEN}" if "Bearer" not in ACCESS_TOKEN else ACCESS_TOKEN,
            "Content-Type": "application/json"
        }
        
        # Ensure the header has the correct Bearer prefix formatting automatically
        if not headers["Authorization"].startswith("Bearer "):
            headers["Authorization"] = f"Bearer {ACCESS_TOKEN}"
        
        payload = {
            "contents": {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": image_b64
                        }
                    }
                ]
            }
        }
        
        # 4. Fire the network request completely outside of local Google configurations
        api_response = requests.post(url, json=payload, headers=headers)
        response_json = api_response.json()
        
        # Extract text response or raise clear error details
        if "error" in response_json:
            print(f"❌ Vertex API Error Response: {response_json}")
            return jsonify({"error": response_json["error"]["message"]}), 400
            
        try:
            description_text = response_json['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError):  # Fixed typo from IndexException to IndexError
            print(f"❓ Unexpected structural response: {response_json}")
            description_text = "No identifiable objects detected."
            
        print(f"🤖 Vertex Token Analysis: \"{description_text}\"")
        
        # 5. GENERATE HUMAN SPEECH VIA ELEVENLABS
        audio_stream = eleven_client.text_to_speech.convert(
            text=description_text,
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel
            model_id="eleven_flash_v2_5",
            output_format="mp3_44100_128"
        )
        
        # 6. Save and cache-bust
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