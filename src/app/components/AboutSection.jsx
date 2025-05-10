"use client";
import React, { useTransition, useState } from "react";
import Image from "next/image";
import TabButton from "./TabButton";

const TAB_DATA = [
  {
    title: "Skills",
    id: "skills",
    content: (
      <ul className="list-disc pl-2">
    <li>React | Node.js | Express.js</li>
    <li>JavaScript | TypeScript</li>
    <li>SQL (MongoDB/MySQL)</li>
    <li>Version Control (Git/GitHub)</li>
    <li>UI Frameworks (Bootstrap/Tailwind CSS/Next.js)</li>
    <li>Redux | Redux Toolkit</li>
    <li>Machine Learning & Data Science (TensorFlow | PyTorch | Pandas | NumPy)</li>
      </ul>
    ),
  },
  {
    title: "Education",
    id: "education",
    content: (
      <ul className="list-disc pl-2">
    <li><strong>B.E. Computer Engineering</strong> – Thapar Institute of Engineering and Technology, Patiala, Punjab</li>
    <li><strong>Class 12th/10th</strong> – N. K. Bagrodia Public School, Rohini, Delhi</li>
      </ul>
    ),
  },
  {
    title: "Certifications",
    id: "certifications",
    content: (
      <ul className="list-disc pl-2">
        <li>AWS Cloud Practitioner</li>
        <li>Full-Stack Web Development</li>
        <li>Data Science Specialization</li>
      </ul>
    ),
  },
];

const AboutSection = () => {
  const [tab, setTab] = useState("skills");
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (id) => {
    startTransition(() => {
      setTab(id);
    });
  };

  return (
    <section className="text-white" id="about">
      <div className="md:grid md:grid-cols-2 gap-8 items-center py-8 px-4 xl:gap-16 sm:py-16 xl:px-16">
        <Image 
          src="/images/about-image.png" 
          width={500} 
          height={500} 
          alt="About me profile" 
          priority 
        />
        <div className="mt-4 md:mt-0 text-left flex flex-col h-full">
          <h2 className="text-4xl font-bold text-white mb-4">About Me</h2>
          <p className="text-base lg:text-lg ">
            I&apos;m a Full-Stack Developer and Data Science graduate with a strong
            focus on building smart, scalable, and data-driven web applications.
            I specialize in the MERN stack, Java, Python, and SQL, with
            extensive experience developing RESTful APIs and integrating dynamic
            features. I&apos;m passionate about blending functionality with clean,
            responsive design using React, Next.js, Tailwind CSS, and Bootstrap.
          </p>
          <br />
          <p className="text-base lg:text-lg">
            As a Machine Learning enthusiast, I&apos;ve built ML models and leveraged
            data to drive insights and automation. I also explore blockchain
            technology to create decentralized applications. I&apos;m a quick
            learner, a problem-solver, and someone who enjoys collaborating to
            turn ideas into real-world solutions.
          </p>
          <div className="flex flex-row justify-start mt-8">
            <TabButton
              selectTab={() => handleTabChange("skills")}
              active={tab === "skills"}
            >
              {" "}
              Skills{" "}
            </TabButton>
            <TabButton
              selectTab={() => handleTabChange("education")}
              active={tab === "education"}
            >
              {" "}
              Education{" "}
            </TabButton>
            <TabButton
              selectTab={() => handleTabChange("certifications")}
              active={tab === "certifications"}
            >
              {" "}
              Certifications{" "}
            </TabButton>
          </div>
          <div className="mt-8">
            {TAB_DATA.find((t) => t.id === tab).content}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
