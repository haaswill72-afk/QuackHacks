import time
import os
from dotenv import load_dotenv
import cv2
from PIL import Image
from google import genai
from elevenlabs.client import ElevenLabs

load_dotenv()

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
ELEVEN_KEY = os.environ.get("ELEVENLABS_API_KEY")

if not GEMINI_KEY or not ELEVEN_KEY:
    raise ValueError("❌ Missing API keys! Check your hidden .env file.")

gemini_client = genai.Client(api_key=GEMINI_KEY)
eleven_client = ElevenLabs(api_key=ELEVEN_KEY)

def run_accessibility_wand():
    print("\n🚀 [1/4] Activating laptop webcam...")
    
    # Open connection to the laptop's default camera
    camera = cv2.VideoCapture(0)
    time.sleep(1.5)  # Give the lens a moment to adjust to lighting
    
    ret, frame = camera.read()
    if not ret:
        print("❌ Error: Webcam capture failed. Close Zoom, Discord, or FaceTime if they are running.")
        camera.release()
        return
        
    # Save the photo locally
    image_filename = "wand_capture.jpg"
    cv2.imwrite(image_filename, frame)
    print(f"📷 Photo captured successfully and saved as '{image_filename}'")
    camera.release()

    # 2. ASK GEMINI WHAT IT SEES
    print("🧠 [2/4] Sending image to Gemini API...")
    pil_image = Image.open(image_filename)
    
    prompt = (
        "You are a helpful, empathetic assistant for a visually impaired user. "
        "Analyze this image taken from their device's camera. Describe exactly what is "
        "directly in front of them in 2 short, concise sentences. Focus purely on immediate utility, "
        "reading any visible text, or pointing out physical obstructions."
    )
    
    response = gemini_client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[pil_image, prompt]
    )
    
    description_text = response.text
    print(f"🤖 Gemini Analysis: \"{description_text}\"")

    # 3. GENERATE HUMAN SPEECH VIA ELEVENLABS
    print("✨ [3/4] Sending analysis text to ElevenLabs voice engine...")
    audio_stream = eleven_client.text_to_speech.convert(
        text=description_text,
        voice_id="21m00Tcm4TlvDq8ikWAM",  # Premium default 'Rachel' voice ID
        model_id="eleven_flash_v2_5",    # Low-latency model for fast hackathon responses
        output_format="mp3_44100_128"
    )

    # 4. SAVE THE AUDIO FILE
    output_filename = "wand_output.mp3"
    print(f"💾 [4/4] Saving output audio to '{output_filename}'...")
    
    with open(output_filename, "wb") as f:
        for chunk in audio_stream:
            f.write(chunk)
            
    print(f"🎉 SUCCESS! The wand has spoken. Double-click '{output_filename}' to listen to it!")

if __name__ == "__main__":
    run_accessibility_wand()