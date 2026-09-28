/** Folder tree for the read-only code browser. */
export function buildTree(files) {
  const root = { name: "", path: "", dirs: [], files: [] };
  const dirs = new Map([["", root]]);
  for (const file of files) {
    const parts = file.path.split("/");
    let parent = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      const name = parts[index];
      const path = parent ? `${parent}/${name}` : name;
      if (!dirs.has(path)) {
        const dir = { name, path, dirs: [], files: [] };
        dirs.set(path, dir);
        dirs.get(parent).dirs.push(dir);
      }
      parent = path;
    }
    dirs.get(parent).files.push(file);
  }
  const sortNode = (node) => {
    node.dirs.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.path.localeCompare(b.path));
    node.dirs.forEach(sortNode);
  };
  sortNode(root);
  return root;
}
