FROM alpine:3.21

RUN apk add --no-cache dropbear \
    && adduser -D -s /bin/ash test \
    && echo 'test:testpass' | chpasswd

EXPOSE 22

CMD ["dropbear", "-F", "-E", "-R", "-p", "22"]