plugins {
  kotlin("jvm") version "1.9.0"
}

group = "com.firstuser"
version = "0.1.0"

repositories {
  mavenCentral()
}

kotlin {
  jvmToolchain(17)
}
