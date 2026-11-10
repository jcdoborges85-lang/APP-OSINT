from playwright.sync_api import sync_playwright
import time
import os

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_viewport_size({"width": 1920, "height": 1080})
    file_url = f"file://{os.path.abspath('index.html')}"
    page.goto(file_url)
    time.sleep(2)

    # Click Biometria
    try:
        page.screenshot(path='fullscreen_layout.png', full_page=True)
        print("Screenshot saved to fullscreen_layout.png")
    except Exception as e:
        print(f"Error: {e}")

    browser.close()
