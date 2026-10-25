import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Set large viewport so we can see the context panel
        page = await browser.new_page(viewport={'width': 1280, 'height': 2000})

        # Load the main page
        await page.goto("http://localhost:8000/index.html")

        # Verify Context panel
        # Click on the accordion for Extractor
        accordion = page.locator('span:has-text("Extrator Automático & Correlacionador")')
        await accordion.click()

        # Input the payload
        textarea = page.locator('#extratorInput')
        await textarea.fill("Testing <script>alert('xss context')</script> and some email test@test.com on the same line")

        # Process the input
        btn_analisar = page.locator('button:has-text("Analisar Dados")')
        await btn_analisar.click()

        # click on the email result
        email_btn = page.locator('button:has-text("test@test.com")')
        await email_btn.click()

        await page.screenshot(path="verification_context_3.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
