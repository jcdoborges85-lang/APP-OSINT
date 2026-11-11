import re

with open('index.html', 'r') as f:
    content = f.read()

# I noticed there were 16 buttons and 15 tabs. Let's make sure it's correct.
# btn-analisar-biometria is inside tab-biometria. It was matched incorrectly because it starts with btn-.
# We only want the nav buttons.

# Let's start from a clean slate
import subprocess
subprocess.run(['git', 'checkout', 'index.html'])

with open('index.html', 'r') as f:
    content = f.read()

nav_buttons_ids = [
    'multipesquisa', 'redes', 'plataformas', 'repositorio', 'whoisbr',
    'validadores', 'forense', 'exif', 'dorks', 'coords', 'preservacao',
    'extrator', 'estudio', 'oficios', 'biometria'
]

new_accordion_content = '<p class="sidebar-title">Módulos de Investigação</p>\n'
for tool_id in nav_buttons_ids:
    btn_id = f'btn-{tool_id}'
    tab_id = f'tab-{tool_id}'

    # Extract button HTML
    btn_start = content.find(f'id="{btn_id}"')
    btn_start = content.rfind('<button', 0, btn_start)
    btn_end = content.find('</button>', btn_start) + len('</button>')
    btn_html = content[btn_start:btn_end]

    # Extract tab html
    tab_start = content.find(f'<div id="{tab_id}"')

    # Extract matching div
    i = tab_start
    div_count = 0
    in_tab = False
    tab_end = tab_start
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

    new_accordion_content += f'        <div class="flex flex-col w-full">\n            {btn_html}\n            {tab_html}\n        </div>\n'

# Find the start of accordion-list
acc_start = content.find('<div class="accordion-list">')
# Find the end of accordion-list (it ends after the last button, before the first tab-content)
acc_end = content.find('</div>', content.find('</button>', content.rfind('id="btn-biometria"'))) + 6

# the tabs are right after accordion-list, until the footer
footer_start = content.find('<footer')
app_shell_end = content.rfind('</div>', 0, footer_start) + 6

# The tabs are between acc_end and app_shell_end
new_content = content[:acc_start] + '<div class="accordion-list">\n' + new_accordion_content + '        </div>\n    </div>\n\n' + content[footer_start:]

with open('index.html', 'w') as f:
    f.write(new_content)

print("Done rewriting index.html")
