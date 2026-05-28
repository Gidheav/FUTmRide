import re
file_path = 'frontend/src/campus-admin/pages/SettingsPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'background:\s*T\.bgInput', "background: 'transparent'", content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
