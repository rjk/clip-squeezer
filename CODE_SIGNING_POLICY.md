# Code signing policy

Official Windows releases of Clip Squeezer are code signed to help users verify that the application comes from the Clip Squeezer project and has not been modified after release.

**Free code signing provided by SignPath.io, certificate by SignPath Foundation.**

## Official source

The official source code repository is:

https://github.com/rjk/clip-squeezer

Official releases are published from this repository. Binaries submitted for signing are produced from the project's public source code and build configuration.

## Team roles

Clip Squeezer is currently maintained by Rory Kingan (`@rjk`).

### Authors / committers

Rory Kingan (`@rjk`) is permitted to modify the project's source code and build configuration directly.

External contributions are made through pull requests and are reviewed before being merged.

### Reviewers

Rory Kingan (`@rjk`) reviews contributions from people who do not have direct commit access to the repository.

### Approvers

Rory Kingan (`@rjk`) is responsible for approving releases submitted for code signing.

If additional maintainers are added in future, this policy will be updated to identify their roles.

## Release and signing process

Official signed releases are built from source code stored in the public Clip Squeezer repository.

The release process is intended to ensure that:

1. source code and build scripts used to produce a release are publicly available;
2. release artifacts are produced by the project's automated build process;
3. binaries are not modified after they have been built and submitted for signing;
4. each signing request is manually approved by an authorised project approver; and
5. signed artifacts are published only through official Clip Squeezer distribution channels.

Third-party open-source components bundled with Clip Squeezer are not signed as though they were authored by the Clip Squeezer project.

## Security of project accounts

Maintainers with access to the source repository or code-signing system are required to use multi-factor authentication.

Access to release and signing systems is restricted to authorised maintainers.

## Privacy

Clip Squeezer processes video and audio files locally on the user's computer.

The application does not upload users' media files for processing.

See the [Clip Squeezer privacy policy](./PRIVACY.md) for details.

## Reporting concerns

Security problems or concerns about an official Clip Squeezer binary should be reported through the project's GitHub repository:

https://github.com/rjk/clip-squeezer/issues

If a problem should not initially be disclosed publicly, please use GitHub's private security-reporting facility where available.