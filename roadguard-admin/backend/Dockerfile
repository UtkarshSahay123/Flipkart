FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 10001 --create-home roadguard
COPY --from=build /build/target/roadguard-admin-backend-*.jar /app/roadguard.jar
USER 10001
EXPOSE 8083
ENTRYPOINT ["java", "-XX:+UseSerialGC", "-XX:MaxRAMPercentage=40.0", "-XX:MaxMetaspaceSize=128m", "-XX:ReservedCodeCacheSize=32m", "-XX:MaxDirectMemorySize=32m", "-Xss512k", "-jar", "/app/roadguard.jar"]
