# Skill Rails v0.4.3 legacy capsule

This directory preserves the pre-greenfield implementation as a non-executable archive. It is evidence and an offline recovery source, not a build input, runtime fallback, skill-discovery root, or compatibility contract.

- `inventory.json` records every captured original path, classification, Git object, Git-mode, base-byte hash, and working-byte hash.
- `legacy-source.tar` stores the captured working-tree bytes at their original repository-relative paths.
- `restore-receipt.json` records the temporary-root restoration check and its limits.

Normal comparison should use the published `v0.4.3` tag. The capsule is for exact physical recovery when Git access is unavailable or when the inventory says working bytes differ from Git bytes.

Never extract directly over a live checkout. Extract into a new temporary root, verify the receipt and every inventory row, and obtain explicit user approval before replacing current files.
