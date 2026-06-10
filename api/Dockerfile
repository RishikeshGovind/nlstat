FROM rocker/r-ver:4.3.2

RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev libssl-dev libxml2-dev libsodium-dev \
    && rm -rf /var/lib/apt/lists/*

RUN R -e "install.packages(c('plumber','cluster','jsonlite'), repos='https://cran.r-project.org/', Ncpus=4)"

WORKDIR /app
COPY plumber.R .
COPY nl_data.json .

EXPOSE 7860

CMD ["Rscript", "-e", "pr <- plumber::plumb('plumber.R'); pr$run(host='0.0.0.0', port=7860)"]
