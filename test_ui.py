import subprocess
import time
from playwright.sync_api import sync_playwright

# Start a local static HTTP server
server = subprocess.Popen(["python3", "-m", "http.server", "8000"])

# Give the server a moment to start
time.sleep(1)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8000/index.html")

        # Wait for the biometria button and click it
        btn_biometria = page.locator("#btn-biometria")
        btn_biometria.wait_for()
        btn_biometria.click()

        # Check if tab-biometria is visible (does not have 'hidden' class)
        tab_biometria = page.locator("#tab-biometria")
        tab_biometria.wait_for(state="visible")

        is_hidden = "hidden" in tab_biometria.get_attribute("class")
        assert not is_hidden, "tab-biometria should not be hidden"
        print("Test passed: tab-biometria is visible")

        # Click on 'Gerador de Ofício' button
        btn_oficios = page.locator("#btn-oficios")
        btn_oficios.click()

        # Check if tab-biometria is now hidden
        tab_oficios = page.locator("#tab-oficios")
        tab_oficios.wait_for(state="visible")

        is_hidden = "hidden" in tab_biometria.get_attribute("class")
        assert is_hidden, "tab-biometria should be hidden now"
        print("Test passed: tab-biometria is hidden after clicking another tab")

        browser.close()

finally:
    server.terminate()
