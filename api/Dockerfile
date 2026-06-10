FROM rstudio/plumber

RUN Rscript -e "install.packages(c('cluster','jsonlite'), repos='https://cran.r-project.org/')" && \
    Rscript -e "library(plumber); library(cluster); library(jsonlite); cat('packages OK\n')"

WORKDIR /app
COPY plumber.R .
COPY nl_data.json .

EXPOSE 7860

ENTRYPOINT []
CMD ["Rscript", "-e", "pr <- plumber::plumb('plumber.R'); pr$run(host='0.0.0.0', port=7860)"]
