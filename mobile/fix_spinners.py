import os
import re

directories = [
    'src/student/pages',
    'src/student/components',
    'src/student/components/rides',
    'src/student/screens'
]

for root_dir in directories:
    if not os.path.exists(root_dir): continue
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.tsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # If there are broken tags like < size="small" /> or < color="#fff" />
                if re.search(r'<\s+(size|color)=', content):
                    print(f"Fixing broken syntax in {path}")
                    content = re.sub(r'<\s+(size|color)=[^>]*>', '<LoadingOverlay visible={true} inline size={20} />', content)

                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
