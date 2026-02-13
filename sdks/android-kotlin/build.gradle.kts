plugins {
  kotlin("jvm") version "1.9.0"
  `java-library`
  `maven-publish`
}

group = providers.gradleProperty("POM_GROUP_ID").orElse("com.firstuser").get()
version = providers.gradleProperty("VERSION_NAME").orElse("1.0.0").get()

repositories {
  mavenCentral()
}

kotlin {
  jvmToolchain(17)
}

java {
  withSourcesJar()
}

publishing {
  publications {
    create<MavenPublication>("release") {
      from(components["java"])

      groupId = project.group.toString()
      artifactId = providers.gradleProperty("POM_ARTIFACT_ID").orElse("firstuser-sdk-android").get()
      version = project.version.toString()

      pom {
        name.set(providers.gradleProperty("POM_NAME").orElse("FirstUser Android SDK"))
        description.set(providers.gradleProperty("POM_DESCRIPTION").orElse("FirstUser production Android SDK"))
        url.set(providers.gradleProperty("POM_URL").orElse("https://github.com/chriscarm/firstuserfinal"))

        licenses {
          license {
            name.set(providers.gradleProperty("POM_LICENSE_NAME").orElse("MIT License"))
            url.set(providers.gradleProperty("POM_LICENSE_URL").orElse("https://opensource.org/licenses/MIT"))
          }
        }

        developers {
          developer {
            id.set(providers.gradleProperty("POM_DEVELOPER_ID").orElse("firstuser"))
            name.set(providers.gradleProperty("POM_DEVELOPER_NAME").orElse("FirstUser Team"))
          }
        }

        scm {
          url.set(providers.gradleProperty("POM_SCM_URL").orElse("https://github.com/chriscarm/firstuserfinal"))
        }
      }
    }
  }

  repositories {
    val mavenRepoUrl = System.getenv("MAVEN_REPOSITORY_URL")
    if (!mavenRepoUrl.isNullOrBlank()) {
      maven {
        name = "release"
        url = uri(mavenRepoUrl)
        credentials {
          username = System.getenv("MAVEN_REPOSITORY_USERNAME")
          password = System.getenv("MAVEN_REPOSITORY_PASSWORD")
        }
      }
    }
  }
}
