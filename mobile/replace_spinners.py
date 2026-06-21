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
            if file.endswith('.tsx') and file != 'LoginScreen.tsx':
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if 'ActivityIndicator' in content:
                    print(f"Fixing {path}")
                    content = re.sub(r'\s*ActivityIndicator,?', '', content)
                    content = re.sub(r"import\s*{\s*}\s*from\s*'react-native'\n*", '', content)
                    
                    if 'LoadingOverlay' not in content:
                        depth = path.replace('\\', '/').count('/') - 2
                        rel_path = '../' * depth + 'components/LoadingOverlay'
                        if path.replace('\\', '/').startswith('src/student/components/rides'):
                            rel_path = '../LoadingOverlay'
                        elif path.replace('\\', '/').startswith('src/student/components'):
                            rel_path = './LoadingOverlay'
                        elif path.replace('\\', '/').startswith('src/student/pages') or path.replace('\\', '/').startswith('src/student/screens'):
                            rel_path = '../components/LoadingOverlay'
                        
                        import_stmt = f"import LoadingOverlay from '{rel_path}'\n"
                        content = re.sub(r"(import .* from 'react-native'.*\n)", r"\1" + import_stmt, content)

                    content = re.sub(r'<ActivityIndicator[^>]*>', '<LoadingOverlay visible={true} inline size={20} />', content)

                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
