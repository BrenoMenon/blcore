import os
import zipfile
import shutil

for f in ["blcore.zip", "public/blcore.zip"]:
    if os.path.exists(f):
        os.remove(f)

output_zip = "blcore.zip"
exclude_dirs = {"node_modules", ".git", ".aistudio", "dist", ".cache", ".temp", ".vite"}
exclude_extensions = {".zip", ".pyc"}
exclude_files = {".DS_Store"}

with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk("."):
        # filter directories in-place to prevent os.walk from entering them
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith(".")]
        
        for file in files:
            if file in exclude_files or any(file.endswith(ext) for ext in exclude_extensions):
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, ".")
            if rel_path.startswith(".git") or rel_path.startswith("node_modules"):
                continue
            zipf.write(full_path, rel_path)

shutil.copyfile("blcore.zip", "public/blcore.zip")
size_kb = os.path.getsize("blcore.zip") / 1024
print(f"Zip created successfully: blcore.zip ({size_kb:.1f} KB)")
