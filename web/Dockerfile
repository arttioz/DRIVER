FROM node:4-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  git \
  libfontconfig \
  ruby \
  ruby-dev \
  python \
  python-dev \
  && rm -rf /var/lib/apt/lists/* && \
  npm install -g --save bower grunt-cli

RUN gem install sass -v 3.4.22
RUN gem install compass

RUN mkdir -p /opt/web /npm /bower

WORKDIR /npm
COPY package.json /npm/
RUN npm install

WORKDIR /bower
COPY bower.json /bower/
RUN bower install --allow-root --config.interactive=false --force

WORKDIR /opt/web
COPY . /opt/web

ENTRYPOINT ["grunt"]
