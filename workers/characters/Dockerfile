FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends xz-utils libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libsm6 libgl1 libegl1 libxkbcommon0 && rm -rf /var/lib/apt/lists/*
COPY blender-5.1.2-linux-x64.tar.xz /tmp/blender.tar.xz
RUN echo "aaccb355f50183979b698bcce7467103a76261b5fa59f4972295842662a285fb  /tmp/blender.tar.xz" | sha256sum -c - && mkdir /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 && rm /tmp/blender.tar.xz
ENTRYPOINT ["/opt/blender/blender", "--background", "--factory-startup", "--disable-autoexec", "--threads", "2", "--python-exit-code", "1"]
