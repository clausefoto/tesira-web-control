# Publishing to Unraid Community Applications

## Prepared files

- `templates/tesira-web-control.xml`: Docker installation template, including initial control settings.
- `ca_profile.xml`: maintainer and support metadata.
- `icon.svg`: project icon; `docs/images/dashboard.png`: real dashboard screenshot.
- `LICENSE`: MIT license.
- `.github/workflows/publish.yml`: tests, Docker build, image smoke checks, and GHCR publication.

The image target is `ghcr.io/clausefoto/tesira-web-control:beta` for Linux amd64. This document describes the process; it does not imply that a build or Community Applications review has completed.

## Build and publish

Push an application change to main, or select **Actions → Test and publish beta image → Run workflow**. The workflow runs application tests, validates XML, builds the image, checks its HTTP endpoint, verifies that the service runs as UID 99, and tests settings persistence across restart before publishing.

The repository's automatic `GITHUB_TOKEN` authenticates the push. No personal token needs to be added. The workflow requires package write permission; repository or account policy may need to allow Actions to run.

The workflow publishes `beta` and `sha-<full-commit>` image tags. Use the SHA tag when a reproducible image version is needed. Only main publishes; pull requests test without publishing.

## Make the image public

GitHub's initial package visibility is private, even when source code is public. After the first successful build, open the repository's **Packages → tesira-web-control → Package settings** and change visibility to **Public**. Do not submit until a machine without GitHub registry credentials can pull it:

```bash
docker pull ghcr.io/clausefoto/tesira-web-control:beta
```

Confirm the Actions run is green and test a new installation using the published image. The existing manually built container need not be replaced until you are ready. The submission XML uses a host appdata directory rather than the named volume used in earlier manual instructions; keep the old volume if it contains settings you want to transfer.

## Validate and submit

1. Open https://ca.unraid.net/submit and sign in.
2. Supply `https://github.com/clausefoto/tesira-web-control` as the app repository.
3. Run **Validate** and then **Scan**. Inspect the beta listing, icon, screenshot, support link, and configuration fields. Resolve any current portal requirements before submitting.
4. Complete the submission and review the portal's terms personally.
5. Monitor the submission for review feedback. The app is not in Community Applications until the portal accepts and publishes it.

Support currently points to GitHub Issues. Add a real Unraid forum support thread if requested or desired; do not enter a placeholder forum URL.

## Initial defaults versus dashboard settings

`MAIN_TAG`, `MAIN_CHANNELS`, `MAIN_GANG`, `SUB_TAG`, `SUB_CHANNELS`, and `SUB_GANG` are used when there is no saved settings file. Once the dashboard settings are saved, they take priority. Changing a template default then requires making the equivalent change in the dashboard. DSP address and level limits remain environment settings.

The Unraid template maps `/data` to `/mnt/user/appdata/tesira-web-control/config`. Initialization starts as root only to assign ownership of `/data` and the app's settings files, then drops to `PUID:PGID` (Unraid defaults: 99:100). The web server runs without root privileges. If an explicit non-root Docker `--user` is supplied, the entrypoint skips ownership changes; prepare the directory permissions yourself.

## References

- https://ca.unraid.net/submit/help
- https://ca.unraid.net/submit/help/repository-xml
- https://ca.unraid.net/submit/help/repository-info-xml
- https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
