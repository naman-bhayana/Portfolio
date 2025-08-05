"use client";
import React, { useState, useRef } from "react";
import ProjectCard from "./ProjectCard";
import ProjectTag from "./ProjectTag";
import { motion, useInView } from "framer-motion";

const projectsData = [
  {
    id: 1,
    title: "WanderNest",
    description: " WanderNest is a full-stack vacation rental app with secure CRUD, smart search, reviews, OAuth login, Mapbox maps, and image uploads—powered by RESTful APIs and encrypted data handling for a seamless booking experience.",
    image: "/images/projects/wandernest.png",
    tag: ["All", "Web","AI/ML"],
    gitUrl: "https://github.com/naman-bhayana/WanderNest",
    previewUrl: "https://wandernest-j69y.onrender.com/",
  },
  {
    id: 2,
    title: "Plinko",
    description: "Plinko is a web-based game where users drop a ball through a peg-filled pyramid to win random multipliers, inspired by the classic Japanese Pachinko.",
    image: "/images/projects/plinko.png",
    tag: ["All", "Web","Blockchain"],
    gitUrl: "https://github.com/naman-bhayana/Plinko",
    previewUrl: "https://plinko-frontend-hvak.onrender.com/",
  },
  {
    id: 3,
    title: "Intellishop",
    description: "A smart retail experience powered by AI and robotics. The application allows users to place orders, track deliveries, and interact with robotic assistants in store.",
    image: "/images/projects/1.png",
    tag: ["All", "Web","AI/ML"],
    gitUrl: "https://github.com/naman-bhayana/Intellishop",
    previewUrl: "https://github.com/naman-bhayana/Intellishop",
  },
  {
    id: 4,
    title: "Jobzee",
    description: "Jobzee is a web-based job consultancy platform built with the MERN stack, connecting job seekers and employers through a secure and user-friendly interface.",
    image: "/images/projects/21.png",
    tag: ["All", "Web"],
    gitUrl: "https://github.com/naman-bhayana/Jobzee",
    previewUrl: "https://github.com/naman-bhayana/Jobzee",
  },
  {
    id: 5,
    title: "ArtBlock",
    description: "ArtBlock is a beginner-friendly NFT marketplace where artists can securely showcase and sell digital art, built with a future-ready MERN stack and simulated blockchain features.",
    image: "/images/projects/71.png",
    tag: ["All", "Web","AI/ML","Blockchain"],
    gitUrl: "https://github.com/naman-bhayana/ArtBlock",
    previewUrl: "https://github.com/naman-bhayana/ArtBlock",
  },
  // {
  //   id: 6,
  //   title: "Full-stack Roadmap",
  //   description: "Project 5 description",
  //   image: "/images/projects/6.png",
  //   tag: ["All", "Web"],
  //   gitUrl: "/",
  //   previewUrl: "/",
  // },
];

const ProjectsSection = () => {
  const [tag, setTag] = useState("All");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const handleTagChange = (newTag) => {
    setTag(newTag);
  };

  const filteredProjects = projectsData.filter((project) =>
    project.tag.includes(tag)
  );

  const cardVariants = {
    initial: { y: 50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
  };

  return (
    <section id="projects">
      <h2 className="text-center text-4xl font-bold text-white mt-4 mb-8 md:mb-12">
        My Projects
      </h2>
      <div className="text-white flex flex-row flex-wrap justify-center items-center gap-2 py-6">
        <ProjectTag
          onClick={handleTagChange}
          name="All"
          isSelected={tag === "All"}
        />
        <ProjectTag
          onClick={handleTagChange}
          name="Web"
          isSelected={tag === "Web"}
        />
        <ProjectTag
          onClick={handleTagChange}
          name="AI/ML"
          isSelected={tag === "AI/ML"}
        />
        <ProjectTag
          onClick={handleTagChange}
          name="Blockchain"
          isSelected={tag === "Blockchain"}
        />
      </div>
      <ul ref={ref} className="grid md:grid-cols-3 gap-8 md:gap-12">
        {filteredProjects.map((project, index) => (
          <motion.li
            key={index}
            variants={cardVariants}
            initial="initial"
            animate={isInView ? "animate" : "initial"}
            transition={{ duration: 0.3, delay: index * 0.4 }}
          >
            <ProjectCard
              key={project.id}
              title={project.title}
              description={project.description}
              imgUrl={project.image}
              gitUrl={project.gitUrl}
              previewUrl={project.previewUrl}
            />
          </motion.li>
        ))}
      </ul>
    </section>
  );
};

export default ProjectsSection;
