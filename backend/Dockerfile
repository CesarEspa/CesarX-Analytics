FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

COPY pom.xml .
COPY .mvn/ .mvn/
COPY mvnw .
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

COPY src/ src/
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

COPY --from=build /app/target/analytics-backend.jar app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]
