FROM ubuntu:kinetic-20221101
FROM python:3.9

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# This ensures that you will have the right permissions inside docker

# User and group variables
ARG USRNM
ARG USRUID
ARG USRGID

# Create user and add to the specified group
RUN groupadd -g $USRGID $USRNM || echo "Could not create group with GID $USRGID".
RUN useradd -g $USRGID -u $USRUID -m $USRNM

# install sudo
RUN apt-get update && apt-get -y install sudo
     
# Add user to sudoers
RUN adduser $USRNM sudo

# Ensure sudo group users are not 
# asked for a password when using 
# sudo command by ammending sudoers file
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers


RUN echo 'alias ll="ls -lah"' >> /home/$USRNM/.bashrc

# make sure apt is up to date
RUN apt-get update --fix-missing && apt-get -yq dist-upgrade && \
apt-get install --no-install-recommends -yq nano && \
apt-get install --no-install-recommends -yq htop && \
apt-get install --no-install-recommends -yq ffmpeg && \
apt-get install --no-install-recommends -yq rsync && \
apt-get install --no-install-recommends -yq lsof && \
apt-get install --no-install-recommends -yq zip && \
apt-get install --no-install-recommends -yq unzip && \
apt-get install --no-install-recommends -yq gcc g++ make && \
apt-get install --no-install-recommends -yq wget && \
apt-get install --no-install-recommends -yq git

RUN apt-get update --fix-missing
RUN apt-get install -y curl
RUN apt-get install -y build-essential libssl-dev

ENV NVM_DIR /usr/local/nvm
RUN mkdir -p $NVM_DIR

# node >= 17 is not good
ENV NODE_VERSION 16.19.1

# Install nvm with node and npm
RUN curl https://raw.githubusercontent.com/creationix/nvm/v0.39.1/install.sh | bash \
    && source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN npm install -g yarn

USER $USRNM
ENTRYPOINT "/bin/bash"