# 12_CHANGELOG

## Changelog

All notable changes to {PROJECT_NAME} will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- {FEATURE_ADDED_1}
- {FEATURE_ADDED_2}

### Changed
- {CHANGE_1}
- {CHANGE_2}

### Fixed
- {BUGFIX_1}
- {BUGFIX_2}

### Deprecated
- {DEPRECATION_1}

### Removed
- {REMOVAL_1}

### Security
- {SECURITY_FIX_1}

---

## [{VERSION_TAG}] - {RELEASE_DATE}

### Added
- Initial project documentation (12-docs standard)
- ADRs for major architectural decisions
- Prompt templates for development workflow
- PR template and verification scripts

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

---

## [{PREVIOUS_VERSION}] - {PREVIOUS_DATE}

### Added
- {PREV_FEATURE_1}
- {PREV_FEATURE_2}

### Changed
- {PREV_CHANGE_1}

### Fixed
- {PREV_BUGFIX_1}

---

## Versioning Scheme

- **Major (X.0.0):** Breaking changes, architectural shifts
- **Minor (X.Y.0):** New features, backward-compatible
- **Patch (X.Y.Z):** Bug fixes, minor improvements

---

## Release Process

1. Update this changelog before release
2. Update version numbers in:
   - `package.json`
   - `mekong.config.yaml`
   - `docs/01_GOAL.md`
3. Create git tag: `git tag -a v{VERSION} -m "Release v{VERSION}"`
4. Push tag: `git push origin v{VERSION}`
5. Update deployment (if applicable)

---

## Changelog Categories

- **Added:** New features
- **Changed:** Modifications to existing functionality
- **Deprecated:** Soon-to-be-removed features
- **Removed:** Removed features
- **Fixed:** Bug fixes
- **Security:** Security patches

---

*Keep this file updated with each release. Use conventional commit messages to track changes.*
