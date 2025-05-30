
const {instance} = require("../config/razorpay");
const User = require("../models/User");
const Course = require("../models/Course");
const CourseProgress = require("../models/CourseProgress");
const {mailSender} = require("../utils/MailSender");
const {courseEnrollmentEmail} = require("../mail/templates/courseEnrollmentEmail");
const mongoose = require("mongoose");
const {paymentSuccessEmail} = require("../mail/templates/paymentSuccessEmail");
const crypto = require("crypto");

// for buying multiple course
// create order
exports.capturePayment = async (req, res) => {
    try{
        const {courses} = req.body;
        const userId = req.user.id;

        let totalAmount = 0;

        for(const courseId of courses ){

            try{
                const courseDetails = await Course.findById({_id:courseId});
    
                if(!courseDetails){
                    return res.status(404).json({
                        success:false,
                        message:"Course not found",
                    })
                }
    
                const uid = new mongoose.Types.ObjectId(userId);
                if( courseDetails.studentEnrolled.includes(uid) ){
                    return res.status(200).json({
                        success:false,
                        message:"User already enrolled course",
                    })
                }
    
                totalAmount = totalAmount + courseDetails.price;
            }
            catch(err){
                return res.status(500).json({
                    success:false,
                    message:err.message,
                })
            }

        }


        // options
        const options = {
            amount : totalAmount * 100,
            currency : "INR",
            receipt:Math.random(Date.now()).toString(),
        }

        
        const paymentResponse = await instance.orders.create(options);
        return res.status(200).json({
            success:true,
            paymentResponse,
        })
        
        
    }
    catch(err){
        return res.status(500).json({
            success:false,
            message:err.message,
        })
    }
}

// verify the payment
exports.verifyPayment = async (req, res) => {
    try{
        const razorpay_order_id = req?.body?.razorpay_order_id;
        const razorpay_payment_id = req?.body?.razorpay_payment_id;
        const razorpay_signature = req?.body?.razorpay_signature;

        const courses = req?.body?.courses;
        const userId = req.user.id;

        if( !razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courses || !userId ){
            return res.status(200).json({
                success:false,
                message:"Payment Failed" 
            })
        }

        let body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET)
                                        .update(body.toString())
                                        .digest("hex");

        if( expectedSignature === razorpay_signature ){

            // enroll student
            await enrollStudents(courses, userId, res);

            // return
            return res.status(200).json({
                success:true,
                message:"Payment Verified",
            })
        }

        return res.status(500).json({
            success:false,
            message:"Payment Failed",
        })
    }
    catch(err){
        return res.status(500).json({
            success:false,
            message:"Payment Failed3",
        })
    }
}

// enroll students
const enrollStudents = async (courses, userId, res) => {
    try{
        if( !courses || !userId ){
            return res.status(400).json({
                success:false,
                message:"Please Provide data for Courses or UserId",
            })
        }

        for(const courseId of courses ){

            // find the course and enroll the student in it
            const enrolledCourse = await Course.findByIdAndUpdate({_id:courseId},
                                                                    {
                                                                        $push:{
                                                                            studentEnrolled:userId,
                                                                        }
                                                                    },
                                                                    {new:true});

            if(!enrolledCourse){
                return res.status(500).json({
                    success:false,
                    message:"Course not found",
                })
            }

            // creating the course progress for the student
            const courseProgress = await CourseProgress.create({
                courseId:courseId,
                userId:userId,
                completedVideos:[],
            });

            // find the student and add the course to their list of enrolledCourses
            const enrolledStudents = await User.findByIdAndUpdate({_id:userId},
                                                                    {
                                                                        $push:{
                                                                            courses:courseId,
                                                                            courseProgress:courseProgress?._id,
                                                                        }
                                                                    },
                                                                    {new:true});

            // sending mail to student
            const mailResponse = await mailSender( enrolledStudents.email,
                                                    `Successfully Enrolled into ${enrolledCourse.courseName}`,
                                                    courseEnrollmentEmail(enrolledCourse.courseName, `${enrolledStudents.firstName} ${enrolledStudents.lastName}` )  );

        }

    }catch(err){
        return res.status(500).json({
            success:false,
            message:err.message,
        });
    }
}


// payment successfull emails
exports.sendPaymentSuccessEmail = async (req, res) => {
    try{
        const {orderId, paymentId, amount} = req.body;

        const userId = req.user.id;

        // validations
        if( !orderId || !paymentId || !amount || !userId){
            return res.status(400).json({
                success:false,
                message:"Please provide all the fields"
            })
        }

        // find student
        const enrolledStudent = await User.findById({_id:userId});

        await mailSender( enrolledStudent.email, "Payment Recieved", paymentSuccessEmail(`${enrolledStudent.firstName} ${enrolledStudent.lastName}`, 
                                                                                               amount/100,
                                                                                               orderId,
                                                                                               paymentId) );
    }
    catch(error){
        return res.status(500).json({
            success:false,
            message:error.message,
        });
    }
}

