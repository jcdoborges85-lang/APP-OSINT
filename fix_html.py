from html.parser import HTMLParser
import re

class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tabs = []
        self.buttons = []
        self.in_accordion_list = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'button' and 'id' in attrs_dict and attrs_dict['id'].startswith('btn-'):
             self.buttons.append(attrs_dict['id'])
        if tag == 'div' and 'id' in attrs_dict and attrs_dict['id'].startswith('tab-'):
             self.tabs.append(attrs_dict['id'])

parser = MyHTMLParser()
with open('index.html', 'r') as f:
    content = f.read()

parser.feed(content)
print(f"Found {len(parser.buttons)} buttons and {len(parser.tabs)} tabs")

# For each button, extract its full HTML and the corresponding tab full HTML
new_accordion_content = '<p class="sidebar-title">Módulos de Investigação</p>\n'
for btn_id in parser.buttons:
    tab_id = btn_id.replace('btn-', 'tab-')

    # Extract button html
    btn_start = content.find(f'<button onclick="switchTab(\'{btn_id.replace("btn-", "")}\')" id="{btn_id}"')
    if btn_start == -1:
         # try finding another way
         btn_start = content.find(f'id="{btn_id}"')
         btn_start = content.rfind('<button', 0, btn_start)
    btn_end = content.find('</button>', btn_start) + len('</button>')
    btn_html = content[btn_start:btn_end]

    # Extract tab html
    tab_start = content.find(f'<div id="{tab_id}"')

    # Simple nested div extraction for tab content
    tab_end = tab_start
    div_count = 0
    in_tab = False

    # using regex to find all <div and </div correctly is hard. Let's use a simpler approach.
    # since we know the structure, let's find the tab div and its corresponding closing tag

    # Find all divs from tab_start
    i = tab_start
    while i < len(content):
         if content[i:i+4] == '<div':
             div_count += 1
             in_tab = True
             i += 4
         elif content[i:i+6] == '</div>':
             div_count -= 1
             i += 6
             if in_tab and div_count == 0:
                 tab_end = i
                 break
         else:
             i += 1

    tab_html = content[tab_start:tab_end]

    new_accordion_content += f'<div class="flex flex-col w-full">\n{btn_html}\n{tab_html}\n</div>\n'

# Now we need to replace the old accordion-list and tabs with the new content
# Find the start of accordion-list
acc_start = content.find('<div class="accordion-list">')
# Find the end of accordion-list (it ends after the last button, before the first tab-content)
acc_end = content.find('</div>', content.find('</button>', content.rfind('id="btn-'))) + 6

# the tabs are right after accordion-list, until the footer
footer_start = content.find('<footer')
app_shell_end = content.rfind('</div>', 0, footer_start)

# The tabs are between acc_end and app_shell_end
new_content = content[:acc_start] + '<div class="accordion-list">\n' + new_accordion_content + '</div>\n' + content[app_shell_end:]

with open('index.html', 'w') as f:
    f.write(new_content)

print("Done rewriting index.html")
