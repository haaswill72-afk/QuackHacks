import os
from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
from PIL import Image
import io
from google import genai
from google.genai import types
from elevenlabs.client import ElevenLabs

# Load env variables from your hidden .env file
load_dotenv()

app = Flask(__name__)

# Initialize clients securely
gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
eleven_client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))

@app.route('/analyze', methods=['POST'])
def analyze_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
        
    # 1. Grab the image file sent from the App or Raspberry Pi
    image_file = request.files['image']
    image_bytes = image_file.read()
    pil_image = Image.open(io.BytesIO(image_bytes))
    
    # 2. Query Gemini Vision
    sys_instruction = (
        "You are an assistive vision device. Analyze the image and provide a strict 2-sentence breakdown. "
        "Sentence 1: State the primary object or text verbatim. Sentence 2: Note immediate obstacles or proximity. "
        "Never use conversational filler like 'I see' or 'This is a'."
    )
    
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=pil_image,
            config=types.GenerateContentConfig(
                system_instruction=sys_instruction,
                temperature=0.3,
                max_output_tokens=60
            )
        )
        description_text = response.text
        print(f"🤖 Generated Analysis: {description_text}")
        
        # 3. Generate Speech with ElevenLabs
        audio_stream = eleven_client.text_to_speech.convert(
            text=description_text,
            voice_id="21m00Tcm4TlvDq8ikWAM",
            model_id="eleven_flash_v2_5",
            output_format="mp3_44100_128"
        )
        
        # Save audio temporarily to send back
        output_filename = "server_output.mp3"
        with open(output_filename, "wb") as f:
            for chunk in audio_stream:
                f.write(chunk)
                
        # 4. Return the audio file directly back to the device
        return send_file(output_filename, mimetype="audio/mp3")
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run server locally on port 5001
    app.run(host='0.0.0.0', port=5001, debug=True)