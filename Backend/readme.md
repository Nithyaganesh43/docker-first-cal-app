docker network create mynet
docker run -d --name backend1 --network mynet -p 5000:5000 backend1