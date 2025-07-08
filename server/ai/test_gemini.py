import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("AIzaSyC_1fmTKmE5p1zU4pheLeUm9igOXRNTKCU"))

model = genai.GenerativeModel("gemini-pro")
response = model.generate_content("渋沢栄一の名言を教えて")
print(response.text)
